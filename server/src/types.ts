export interface DbUser {
  id: number;
  fullName: string;
  email: string;
  password: string;
  role?: string;
}

export interface SafeUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

export interface ReqUser {
  id: number;
  role: string;
}
