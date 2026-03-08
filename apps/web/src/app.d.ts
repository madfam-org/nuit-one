declare global {
  namespace App {
    interface Locals {
      userId?: string;
      workspaceId?: string;
      accessToken?: string;
    }
    interface PageData {
      user?: {
        id: string;
        email: string;
        displayName: string;
      };
      workspace?: {
        id: string;
        name: string;
        slug: string;
        role: string;
      };
    }
  }
}

export {};
