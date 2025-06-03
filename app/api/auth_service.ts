import { ApiResponse, ILoginResponse, LoginCredentialsType } from "../types/interface_data";
import { AUTH_ENDPOINT } from "./api_service";

export class AuthService {
    static async Login(credentials: LoginCredentialsType): Promise<ApiResponse<ILoginResponse>> {
        try {
            const response = await fetch(AUTH_ENDPOINT.login, {
                method: 'POST',
                headers: {
                    'ContentType.Type': "application/json"
                },
                body: JSON.stringify(credentials)
            })
            
            const data = await response.json()
            return data

        } catch(error) {
            console.log("Login API error: " + error)
            return {
                success: false,
                message: "Network Error?"
            }
        }
    }
}