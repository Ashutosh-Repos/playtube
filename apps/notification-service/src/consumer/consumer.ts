import { consumeMessage , QUEUES, EXCHANGES, EVENTS, userEmailVerificationTokenCreatedSchema, userPasswordResetTokenCreatedSchema} from "@repo/events";
import type { UserEmailVerificationTokenCreatedEvent, UserPasswordResetTokenCreatedEvent } from "@repo/events";
import { EmailService } from "../services/email-service";

const emailService = new EmailService();


const startConsumer = async () => {
    await consumeMessage(
        QUEUES.EMAIL_VERIFICATION_QUEUE, EXCHANGES.USER, EVENTS.USER_EMAIL_VERIFICATION_TOKEN_CREATED,userEmailVerificationTokenCreatedSchema, 
        async (rawMessage: UserEmailVerificationTokenCreatedEvent) => {
            const message = userEmailVerificationTokenCreatedSchema.parse(rawMessage);

            const html = emailService.generateEmailTemplates.emailVerificationMail(message.token,message.expiresAt);

            const repsonse = await emailService.sendEmail(message.email,"Verify Your Email",html);
            if(repsonse) return repsonse;
        }
    );

    await consumeMessage(
        QUEUES.PASSWORD_RESET_QUEUE, EXCHANGES.USER, EVENTS.USER_PASSWORD_RESET_TOKEN_CREATED,userPasswordResetTokenCreatedSchema, 
        async (rawMessage: UserPasswordResetTokenCreatedEvent) => {
            const message = userPasswordResetTokenCreatedSchema.parse(rawMessage);

            const html = emailService.generateEmailTemplates.passwordResetMail(message.token,message.expiresAt);

            const hello = await emailService.sendEmail(message.email,"Reset Your Password",html);
            console.log(hello);
        }
    );
}

export default startConsumer;


    