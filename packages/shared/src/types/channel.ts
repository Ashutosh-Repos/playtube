import { ChannelPayload } from "@repo/database";

/**
 * Shared Channel Type for API responses
 * (Standardized public view)
 */
export type ChannelDetails = Omit<ChannelPayload, "createdAt"> & {
    createdAt: string;
};

/**
 * Shared Channel List Item
 */
export type ChannelListItem = ChannelDetails;

// ============================================================================
// Input Types
// ============================================================================

export interface CreateChannelInput {
  name: string;
  handle: string;
  description?: string;
  image?: string;
  bannerUrl?: string;
  contactEmail?: string;
  links?: Array<{
    title: string;
    url: string;
  }>;
}

export interface UpdateChannelInput {
  name?: string;
  description?: string;
  image?: string;
  bannerUrl?: string;
  contactEmail?: string;
  links?: Array<{
    title: string;
    url: string;
  }>;
}
