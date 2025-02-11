'use client'

import { Box } from "@mui/material";
import React, { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps): JSX.Element {
    const { user, isLoading, isLogin } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isLogin) {
            router.push("/login");
        }
    }, [user, router]);

    return (
        <Box>
            {children}
        </Box>
    )
}