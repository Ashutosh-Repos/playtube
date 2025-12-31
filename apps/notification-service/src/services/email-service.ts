import { createTransport, Transporter } from "nodemailer";
import { env } from "@repo/env";

export class EmailService {
    private transporter: Transporter | undefined;

    generateEmailTemplates = {
        emailVerificationMail: (token: string, expireAt:string) => {
            const url = `${env.APP_URL}/verify-email?token=${token}`;
            return `
            <h1>Verify Your Email</h1>
            <p>Click the link below to verify your email address:</p>
            <a href="${url}" style="padding: 10px 20px; color: white; background-color: #007bff; text-decoration: none; border-radius: 5px;">Verify Email</a>
            <p>Or copy this link: ${url}</p>
            <p>This link expires at ${expireAt}</p>
            `;
        },

        passwordResetMail: (token: string, expireAt:string) => {
            const url = `${env.APP_URL}/reset-password?token=${token}`;
            return `
            <h1>Reset Your Password</h1>
            <p>Click the link below to reset your password:</p>
            <a href="${url}" style="padding: 10px 20px; color: white; background-color: #dc3545; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>Or copy this link: ${url}</p>
            <p>This link expires at ${expireAt}</p>
            `;
        },

        userJoiningMail: (name: string) => {
            return `
            <h1>Welcome to PlayTube</h1>
            <p>Thank you for joining PlayTube!</p>
            <p>Best regards, PlayTube Team</p>
            `;
        },

        userLeavingMail: (name: string) => {
            return `
            <h1>Goodbye from PlayTube</h1>
            <p>Thank you for using PlayTube!</p>
            <p>Best regards, PlayTube Team</p>
            `;
        },


        userBannedMail: (name: string, reason: string) => {
            return `
            <h1>Goodbye from PlayTube</h1>
            <p>Reason: ${reason}</p>
            <p>Best regards, PlayTube Team</p>
            `;
        },

        userUnbannedMail: (name: string, reason: string) => {
            return `
            <h1>Welcome back to PlayTube</h1>
            <p>Reason: ${reason}</p>
            <p>Best regards, PlayTube Team</p>
            `;
        },

        userSuspensionMail: (name: string, reason: string, duration: string) => {
            return `
            <h1>Goodbye from PlayTube</h1>
            <p>Reason: ${reason}</p>
            <p>Duration: ${duration}</p>
            <p>Best regards, PlayTube Team</p>
            `;
        }
    }

    constructor() {        
        if (env.NODE_ENV === "production" || env.SMTP_HOST) {
            this.transporter = createTransport({
                host: env.SMTP_HOST,
                port: env.SMTP_PORT,
                secure: env.NODE_ENV === "production", // simple logic
                auth: {
                    user: env.SMTP_USER,
                    pass: env.SMTP_PASSWORD,
                },
            });
        } 
        // In dev without host, we leave transporter undefined and handle it in sendEmail
    }

    public async sendEmail(to: string, subject: string, html: string) {
        if (!this.transporter) {
            console.log("\n================ [MOCK EMAIL] ================");
            console.log(`To: ${to}`);
            console.log(`Subject: ${subject}`);
            console.log("----------------------------------------------");
            console.log(html);
            console.log("==============================================\n");
            return;
        }

        const mailOptions = {
            from: env.SMTP_USER || "noreply@playtube.com",
            to,
            subject,
            html,
        };
        const response = await this.transporter.sendMail(mailOptions);
        return response;
    }
}