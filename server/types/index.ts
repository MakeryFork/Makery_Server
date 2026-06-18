export interface VideoEditData {
  clips?: VideoClip[];
  effects?: VideoEffect[];
  texts?: VideoText[];
  audios?: VideoAudio[];
  splits?: VideoSplit[];
  [key: string]: unknown;
}

export interface VideoClip {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  speed: number;
  aspectRatio: string;
  muted: boolean;
  split: { time: number }[];
  audio: { volume: number; fadeIn: number; fadeOut: number };
  animations: VideoAnimation[];
  sourceUrl?: string;
  [key: string]: unknown;
}

export interface VideoAnimation {
  type: string;
  startTime: number;
  endTime: number;
  properties: Record<string, unknown>;
}

export interface VideoEffect {
  clipId: string;
  filter?: string;
  rotate?: number;
  flipH?: boolean;
  flipV?: boolean;
}

export interface VideoText {
  id: string;
  text: string;
  x: number;
  y: number;
  startTime: number;
  endTime: number;
}

export interface VideoAudio {
  id: string;
  name: string;
  url: string;
  startTime: number;
  endTime: number;
}

export interface VideoSplit {
  clipId: string;
  trimStart: number;
  trimEnd: number;
  duration: number;
}

export interface BuyerContent {
  title: string;
  markdownContent: string;
}

export interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  method: string;
  totalAmount: number;
  [key: string]: unknown;
}
