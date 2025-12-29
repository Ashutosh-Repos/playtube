import { createTransport, Transporter } from "nodemailer";
import { env } from "@repo/env";

export class EmailService {
    private transporter: Transporter;

    generateEmailTemplates = {
        emailVerificationMail: (token: string, expireAt:string) => {
            return `
            <h1>Verification Token</h1>
            <p>Use the following token to verify your email:</p>
            <p>${token}</p>
            `;
        },

        passwordResetMail: (token: string, expireAt:string) => {
            return `
            <h1>Password Reset Token</h1>
            <p>Use the following token to reset your password:</p>
            <p>${token}</p>
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
        this.transporter = createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT, // Already coerced to number by Zod
            secure: true,
            auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASSWORD,
            },
        });
    }

    public async sendEmail(to: string, subject: string, html: string) {
        const mailOptions = {
            from: env.SMTP_USER,
            to,
            subject,
            html,
        };
        await this.transporter.sendMail(mailOptions);
    }
}