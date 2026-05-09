import { transcribeFirstAudio as transcribeFirstAudioImpl } from "assistant/plugin-sdk/media-runtime";

type TranscribeFirstAudio = typeof import("assistant/plugin-sdk/media-runtime").transcribeFirstAudio;

export async function transcribeFirstAudio(
  ...args: Parameters<TranscribeFirstAudio>
): ReturnType<TranscribeFirstAudio> {
  return await transcribeFirstAudioImpl(...args);
}
