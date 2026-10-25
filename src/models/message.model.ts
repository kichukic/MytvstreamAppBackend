import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

// A film or show shared from ForUs: enough to draw its card and play it.
const titleSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ['video', 'web', 'stream', 'movie', 'moviebox', 'file'],
      required: true,
    },
    videoId: { type: String, maxlength: 50 },
    url: { type: String, maxlength: 2000 },
    id: { type: String, maxlength: 100 },
    subjectId: { type: String, maxlength: 50 },
    season: { type: Number },
    episode: { type: Number },
    poster: { type: String, maxlength: 2000 },
    year: { type: String, maxlength: 20 },
    source: { type: String, maxlength: 20 },
    itemId: { type: Number },
    fileId: { type: Number },
    title: { type: String, required: true, maxlength: 300 },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    // The pair key of the two people talking.
    conversation: { type: String, required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, maxlength: 4000 },
    title: { type: titleSchema },
    // A voice message. The recording itself lives on the two phones; the
    // server holds it only until the recipient's phone has it (VoiceClip).
    voice: { type: new Schema({ durationMs: { type: Number, required: true } }, { _id: false }) },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
// A conversation's messages newest first, someone's unread ones, and
// everything someone sent (for the conversation list).
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, readAt: 1 });
messageSchema.index({ sender: 1, createdAt: -1 });

export type MessageDoc = InferSchemaType<typeof messageSchema> & { _id: Types.ObjectId; createdAt: Date };
export const Message = model('Message', messageSchema);

export function publicMessage(m: MessageDoc) {
  return {
    id: m._id.toString(),
    sender: m.sender.toString(),
    recipient: m.recipient.toString(),
    text: m.text ?? undefined,
    title: m.title ?? undefined,
    voice: m.voice ? { durationMs: m.voice.durationMs } : undefined,
    createdAt: m.createdAt.toISOString(),
    readAt: m.readAt ? m.readAt.toISOString() : undefined,
  };
}
