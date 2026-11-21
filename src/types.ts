import { Status } from "./state/features/globalSlice";

export interface QdnMediaReference {
  name: string;
  service: string;
  identifier: string;
  sha256?: string;
  bytes?: number;
  filename?: string;
  mimeType?: string;
}

export interface Song {
  id: string;
  author: string;
  artist?: string;
  album?: string;
  description?: string;
  metadataDescription?: string; // compact QDN fields/revision, separate from full description
  legacyFields?: string[]; // derived index fields; never persist as publisher metadata
  genre?: string;
  category?: string;
  categoryName?: string;
  tags?: string[];
  mood?: string;
  bpm?: number;
  releaseDate?: string;
  explicit?: boolean;
  language?: string;
  notes?: string;
  source?: 'ear-bump' | 'q-music';
  audio?: QdnMediaReference;
  coverArt?: QdnMediaReference;
  created?: number;
  updated?: number;
  duration?: number; // seconds
  trackNumber?: number;
  discNumber?: number;
  title: string;
  name: string;
  service: string;
  status?: Status
}

export interface Product {
  id: string;
  active?: boolean;
  name?: string;
  description?: string;
  image?: string;
}
