'use client'

import React, { createContext, ReactNode, useContext, useEffect } from "react";
import { AuthContextType, LoginCredentialsType, IUser } from "../types/interface_data";
import { AuthService } from "../api/auth_service";

interface AuthProviderProps {
    children: ReactNode;

}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
    const [user, setUser] = React.useState<AuthContextType["user"]>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isLogin, setIsLogin] = React.useState(false);

    const login = async (credentials: LoginCredentialsType): Promise<void> => {
        setIsLoading(true);

        try {
            const response = await AuthService.Login(credentials)
            if (response.success && response.data) {
                const { token, user: IUser } = response.data
                localStorage.setItem("token", token)
                localStorage.setItem("user", JSON.stringify(user))

                setUser(user)

                setIsLogin(true)
            } else {
                const errorMessage = response.message || "Login failed!"
                throw new Error(errorMessage)
            }
        } catch (error) {
            console.log(error)
            throw error
        } finally {
            setIsLoading(false)
        }
    }

    const logout = async (): Promise<void> => {
        setIsLoading(false);
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading, isLogin }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }

    return context;
}