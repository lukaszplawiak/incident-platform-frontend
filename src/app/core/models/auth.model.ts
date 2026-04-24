export interface AuthResponse {
  token: string;
}

export interface JwtPayload {
  sub: string; 
  tenantId: string;
  roles: string[];
  iat: number;
  exp: number;
}