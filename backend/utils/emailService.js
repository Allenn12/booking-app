import nodemailer from 'nodemailer';

export async function sendVerificationEmail(email, verificationLink) {
    try {
        // Ako koristiš Mailtrap:
        const transporter = nodemailer.createTransport({
            host: 'sandbox.smtp.mailtrap.io',
            port: process.env.MAILTRAP_PORT,
            secure: false,
            auth: {
                user: "15283a995f2545",
                pass: "7e048a9b500a13"
            },
            tls: {
                // Do not fail on self-signed certificates
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
            from: 'noreply@app.com',
            to: email,
            subject: 'Verificiraj tvoj email',
            html: `
                <h2>Dobrodošli!</h2>
                <p>Klikni donje na link da verificiraš email:</p>
                <a href="${verificationLink}" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none;">
                    Verificiraj Email
                </a>
                <p>Ili kopiraj link: ${verificationLink}</p>
                <p>Link je validan 24 sata.</p>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email poslan: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('❌ Greška pri slanju emaila:', error);
        // ⭐ DETALJNO LOGIRANJE
        console.error('❌ GREŠKA PRI SLANJU EMAILA:');
        console.error('Email:', email);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Full error:', error);
        throw error;
    }
}

export async function sendEmail({ to, subject, text, html }) {
    try {
        const transporter = nodemailer.createTransport({
            host: 'sandbox.smtp.mailtrap.io',
            port: process.env.MAILTRAP_PORT || 2525,
            secure: false,
            auth: {
                user: "15283a995f2545",
                pass: "7e048a9b500a13"
            }
        });

        const mailOptions = {
            from: 'noreply@app.com',
            to,
            subject,
            text,
            html: html || text
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Generic Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending generic email:', error);
        throw error;
    }
}
