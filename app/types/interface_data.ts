export interface ILoginFormData {
  email: string;
  password: string;
}

export interface ILoginResponse {
  message: string;
  token: string;
  user: IUser;
}

export interface IUser {
  id: string;
  email: string;
  name: string;
  role?: "admin" | "user";
}

export interface LoginCredentialsType {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: IUser | null;
  login: (credentials: LoginCredentialsType) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isLogin: boolean;
}

export interface Skill {
  id: string;
  skillName: string;
  gradientColor: string[];
  gradientAngle: number;
  icon: string;
  skillType: string;
}

export interface ApiResponse<T=any> {
  success: boolean,
  message?: string,
  data?: T
  errors?: Array<{
    field: string,
    message: string
  }>
}