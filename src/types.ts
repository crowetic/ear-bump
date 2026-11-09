import { Status } from "./state/features/globalSlice";

export interface Song {
  id: string;
  author: string;
  artist?: string;
  album?: string;
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