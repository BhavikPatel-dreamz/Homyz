export type AuthMode = "login" | "signup";
export type AuthMethod = "phone" | "email";
export type SocialProvider = "google" | "apple" | "facebook";

export interface AuthProviders {
  google?: boolean;
  apple?: boolean;
  facebook?: boolean;
}
