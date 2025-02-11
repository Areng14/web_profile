'use client'

import React, { createContext, ReactNode, useContext, useEffect } from "react";
import { AuthContextType } from "../types/authContextType";
import { LoginCredentialsType } from "../types/LoginCredentialsType";

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