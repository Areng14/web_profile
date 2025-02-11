import React, { ReactElement } from "react";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { Typography } from "@mui/material";

export default function AdminPage(): ReactElement {
    return (
        <ProtectedRoute>
            <Typography variant="h1">Admin Page</Typography>
        </ProtectedRoute>
    )
}