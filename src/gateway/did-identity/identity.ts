export type DidDocument = {
  id: string;
  controller?: string;
  verificationMethod: VerificationMethod[];
  service?: DidService[];
  authentication?: string[];
  assertionMethod?: string[];
  keyAgreement?: string[];
  created: string;
  updated: string;
};

export type VerificationMethod = {
  id: string;
  type: string;
  controller: string;
  publicKeyJwk?: Record<string, unknown>;
  publicKeyMultibase?: string;
};

export type DidService = {
  id: string;
  type: string;
  serviceEndpoint: string;
};

export type DidIdentity = {
  document: DidDocument;
  sign(data: Uint8Array): Promise<Uint8Array>;
  verify(data: Uint8Array, signature: Uint8Array): Promise<boolean>;
  createVerifiableCredential(credential: Record<string, unknown>): Promise<VerifiableCredential>;
  verifyCredential(vc: VerifiableCredential): Promise<boolean>;
  createDelegatedCredential(subject: DidIdentity, credential: Record<string, unknown>): Promise<VerifiableCredential>;
  addService(service: DidService): void;
  getServices(type?: string): DidService[];
  resolve(did: string): Promise<DidDocument | null>;
  exportDocument(): string;
};

export type VerifiableCredential = {
  "@context": string[];
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: Record<string, unknown>;
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    jws: string;
  };
};

export async function createDidIdentity(method: "key" | "web" = "key"): Promise<DidIdentity> {
  const didId = method === "key" ? `did:key:${crypto.randomUUID().replace(/-/g, "")}` : `did:web:zhushou.dev:${crypto.randomUUID().slice(0, 8)}`;

  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyObj = keyPair.privateKey;

  const keyId = `${didId}#key-1`;

  const document: DidDocument = {
    id: didId,
    verificationMethod: [{
      id: keyId,
      type: "JsonWebKey2020",
      controller: didId,
      publicKeyJwk,
    }],
    authentication: [keyId],
    assertionMethod: [keyId],
    service: [{
      id: `${didId}#zhushou-gateway`,
      type: "ZhushouGateway",
      serviceEndpoint: "https://zhushou.dev",
    }],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  const encoder = new TextEncoder();

  return {
    document,

    async sign(data) {
      const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        privateKeyObj,
        data,
      );
      return new Uint8Array(signature);
    },

    async verify(data, signature) {
      try {
        return await crypto.subtle.verify(
          { name: "ECDSA", hash: "SHA-256" },
          keyPair.publicKey,
          signature,
          data,
        );
      } catch {
        return false;
      }
    },

    async createVerifiableCredential(credential) {
      const vc: VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "ZhushouIdentityCredential"],
        issuer: didId,
        issuanceDate: new Date().toISOString(),
        credentialSubject: credential,
        proof: {
          type: "EcdsaSecp256r1Signature2019",
          created: new Date().toISOString(),
          verificationMethod: keyId,
          proofPurpose: "assertionMethod",
          jws: "",
        },
      };

      const payload = encoder.encode(JSON.stringify({ ...vc, proof: undefined }));
      const signature = await this.sign(payload);
      vc.proof.jws = btoa(String.fromCharCode(...signature));

      return vc;
    },

    async verifyCredential(vc) {
      try {
        const { jws, ...proofWithoutJws } = vc.proof;
        const payload = encoder.encode(JSON.stringify({ ...vc, proof: undefined }));
        const signature = Uint8Array.from(atob(jws), (c) => c.charCodeAt(0));
        return await this.verify(payload, signature);
      } catch {
        return false;
      }
    },

    addService(service) {
      if (!document.service) {
        document.service = [];
      }
      document.service.push(service);
      document.updated = new Date().toISOString();
    },

    getServices(type) {
      const services = document.service ?? [];
      if (type) {
        return services.filter((s) => s.type === type);
      }
      return services;
    },

    async createDelegatedCredential(subject, credential) {
      const vc: VerifiableCredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1", "https://w3id.org/security/suites/ecdsa-2019/v1"],
        type: ["VerifiableCredential", "ZhushouDelegatedCredential"],
        issuer: didId,
        issuanceDate: new Date().toISOString(),
        credentialSubject: { ...credential, id: subject.document.id },
        proof: {
          type: "EcdsaSecp256r1Signature2019",
          created: new Date().toISOString(),
          verificationMethod: keyId,
          proofPurpose: "assertionMethod",
          jws: "",
        },
      };

      const payload = encoder.encode(JSON.stringify({ ...vc, proof: undefined }));
      const signature = await this.sign(payload);
      vc.proof.jws = btoa(String.fromCharCode(...signature));

      return vc;
    },

    async resolve(did) {
      if (did === didId) return document;
      return null;
    },

    exportDocument() {
      return JSON.stringify(document, null, 2);
    },
  };
}
