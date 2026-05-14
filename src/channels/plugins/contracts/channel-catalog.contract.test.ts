import {
  describeBundledMetadataOnlyChannelCatalogContract,
  describeChannelCatalogEntryContract,
  describeOfficialFallbackChannelCatalogContract,
} from "../../../../test/helpers/channels/channel-catalog-contract.js";

describeChannelCatalogEntryContract({
  channelId: "msteams",
  npmSpec: "@zhushou/msteams",
  alias: "teams",
});

const whatsappMeta = {
  id: "whatsapp",
  label: "WhatsApp",
  selectionLabel: "WhatsApp (QR link)",
  detailLabel: "WhatsApp Web",
  docsPath: "/channels/whatsapp",
  blurb: "works with your own number; recommend a separate phone + eSIM.",
};

describeBundledMetadataOnlyChannelCatalogContract({
  pluginId: "whatsapp",
  packageName: "@zhushou/whatsapp",
  npmSpec: "@zhushou/whatsapp",
  meta: whatsappMeta,
  defaultChoice: "npm",
});

describeOfficialFallbackChannelCatalogContract({
  channelId: "whatsapp",
  npmSpec: "@zhushou/whatsapp",
  meta: whatsappMeta,
  packageName: "@zhushou/whatsapp",
  pluginId: "whatsapp",
  externalNpmSpec: "@vendor/whatsapp-fork",
  externalLabel: "WhatsApp Fork",
});
