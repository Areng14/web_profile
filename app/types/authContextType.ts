import { LoginCredentialsType } from "./LoginCredentialsType";
import { UserType } from "./userType";

export interface AuthContextType {
    user: UserType | null;
    login: (credentials: LoginCredentialsType) => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
    isLogin: boolean;
}