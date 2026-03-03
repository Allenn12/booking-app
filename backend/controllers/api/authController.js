import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import Country from "../../models/Country.js";
import UserBusiness from "../../models/UserBusiness.js";
import Invitation from "../../models/Invitation.js";
import { hashPassword } from "../../script/hashPassword.js";
import { ERRORS } from "../../utils/errors.js";
import { sendVerificationEmail } from "../../utils/emailService.js";

export async function register(req, res, next) {
    try {
        const {
            first_name,
            last_name,
            email,
            password,
            business_name,
            phone_number,
            job_id,
            country_code,
        } = req.body;
        const emailExists = await User.findByEmail(email);
        const phoneExists = await User.findByPhone(phone_number);
        if (emailExists) {
            throw ERRORS.CONFLICT("Email je već registriran");
        }
        if (phoneExists) {
            throw ERRORS.CONFLICT("Broj mobitela je već registriran");
        }
        const hashedPassword = await hashPassword(password);
        /*const country = await Country.getByCode(country_code);
            if(!country){
                throw ERRORS.NOT_FOUND(`Zemlja nije pronađena: ${country_code}`)
            }*/

        req.session.userEmail = email;
        const result = await User.create({
            first_name,
            last_name,
            email,
            hashedPassword,
            phone_number,
            /*business_name,
                  job_id,
                  country_id: country.id*/
        });
        const userId = result.insertId;
        const { token, expiresAt } = await User.generateAndSaveVerificationToken(
            userId,
            email,
            "email_verification",
        );

        req.session.userId = userId;
        req.session.userEmail = email;

        const verificationLink = `${process.env.APP_URL}/api/v1/auth/verify-email?email=${encodeURIComponent(email)}&token=${token}`;

        await sendVerificationEmail(email, verificationLink);

        return res.status(201).json({
            success: true,
            message: "User registered, verification pending!",
            redirectTo: "/verify-email",
        });
    } catch (error) {
        next(error);
    }
}

export async function verifyEmailToken(req, res, next) {
    try {
        const { email, token } = req.query;
        console.log("🔵 verifyEmailToken pozvan:", {
            email,
            token: token.substring(0, 20) + "...",
        });
        if (!email || !token) {
            throw ERRORS.VALIDATION("Email i token su obavezni");
        }

        const user = await User.findByEmail(email);
        if (!user) {
            throw ERRORS.NOT_FOUND("Korisnik nije pronađen");
        }

        const verificationToken = await User.getVerificationToken(token, email);
        if (!verificationToken) {
            throw ERRORS.VALIDATION("Token nije validan ili je istekao");
        }

        await User.updateVerificationLevel(user.id, "active");
        await User.markVerificationTokenAsUsed(verificationToken.id);

        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.authenticated = true;

        /*const jwtToken = jwt.sign(
                {userId: user.id, email: user.email},
                process.env.JWT_SECRET,
                {expiresIn: '7d'}
            );
    
            res.cookie('authToken', jwtToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000  // 7 dana
            });*/

        console.log("🟢 SESSION POSTAVLJENA NAKON VERIFICATION:", {
            id: req.sessionID,
            data: req.session,
        });

        // ⭐ Handle pending invite
        if (req.session.pendingInviteToken) {
            const token = req.session.pendingInviteToken;
            const invite = await Invitation.findByToken(token);
            if (invite) {
                // Check if already a member (safety)
                const alreadyMember = await UserBusiness.findByUserAndBusiness(user.id, invite.business_id);
                if (!alreadyMember) {
                    await UserBusiness.create(user.id, invite.business_id, invite.role);
                    await Invitation.incrementUsedCount(invite.id);

                    // Add success flash message for new registration + join
                    req.session.flash = { 
                        type: 'success', 
                        message: `Welcome! You have successfully joined ${invite.business_name}.` 
                    };
                }
            }
            delete req.session.pendingInviteToken;
        }

        return res.redirect("http://localhost:5173/verify-email?verified=true");
    } catch (error) {
        next(error);
    }
}

export async function checkVerification(req, res, next) {
    try {
        console.log("🔍 checkVerification - Polling request");

        if (!req.session || !req.session.userId) {
            console.log("❌ Nema sesije");
            return res.status(401).json({
                success: false,
                verified: false,
                message: "Sesija istekla",
            });
        }
        const userId = req.session.userId;
        const user = await User.getByUserId(userId);
        if (!user) {
            console.log("❌ User ne postoji:", userId);
            throw ERRORS.NOT_FOUND("Korisnik nije pronađen");
        }

        const isVerified = user.verification_level === "active";

        if(isVerified){
            req.session.authenticated = true;
        }
        console.log("📊 Status iz baze:", {
            userId: user.id,
            email: user.email,
            verification_level: user.verification_level,
            isVerified,
        });

        return res.status(200).json({
            success: true,
            verified: isVerified,
            verificationLevel: user.verification_level,
        });
    } catch (error) {
        console.error("❌ checkVerification error:", error);
        next(error);
    }
}

export async function resendVerificationLink(req, res, next) {
    try {
        console.log("🔵 resendVerificationLink pozvan");

        // Provjeri session
        if (!req.session || !req.session.userId || !req.session.userEmail) {
            return res.status(401).json({
                success: false,
                message: "Sesija istekla. Molimo prijavite se ponovno.",
            });
        }

        const { userId, userEmail } = req.session;
        console.log("✅ Session OK:", { userId, userEmail });

        await User.invalidateOldTokens(userId, "email_verification");

        // Generiraj novi token
        const { token } = await User.generateAndSaveVerificationToken(
            userId,
            userEmail,
            "email_verification",
        );

        const verificationLink = `${process.env.APP_URL}/api/v1/auth/verify-email?email=${encodeURIComponent(userEmail)}&token=${token}`;

        await sendVerificationEmail(userEmail, verificationLink);

        console.log(`📧 Novi verification email poslan na: ${userEmail}`);

        return res.json({
            success: true,
            message: "Novi verification link poslan na email",
        });
    } catch (error) {
        console.error("❌ resendVerificationLink error:", error);
        next(error);
    }
}

export async function login(req, res, next) {
    try {
        console.log("🔵 LOGIN REQUEST:", req.body);
        const { email, password } = req.body;

        const user = await User.findByEmail(email);
        if (!user) {
            console.log("❌ Validation failed: Email not registered");
            throw ERRORS.AUTH("Email nije registriran");
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log("❌ Validation failed: Password is incorrect");
            throw ERRORS.AUTH("Lozinka je neispravna!");
        }

        if (user.verification_level !== "active") {
            // Postavi PARTIAL session (userId ali NE authenticated: true)
            // WHY: Polling na /verify-email treba znati KOJEG usera provjerava!
            req.session.userId = user.id;
            req.session.userEmail = user.email;
            req.session.authenticated = false; // ← Nije još authenticated!

            await User.invalidateOldTokens(user.id, "email_verification");

            // Pošalji verifikacijski email
            const { token } = await User.generateAndSaveVerificationToken(
                user.id,
                user.email,
                "email_verification",
            );

            const verificationLink = `${process.env.APP_URL}/api/v1/auth/verify-email?email=${encodeURIComponent(email)}&token=${token}`;

            await sendVerificationEmail(email, verificationLink);

        console.log("📧 Verification email poslan za:", user.email);

            return res.status(203).json({
                success: false,
                user: {
                    id: user.id,
                    email: user.email
                },
                code: "EMAIL_NOT_VERIFIED",
                message: "Email nije verificiran. Poslali smo ti verifikacijski link.",
                redirectTo: '/verify-email'
            });
        }

        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.authenticated = true;

        console.log("🟢 SESSION NAKON LOGIN:", {
            id: req.sessionID,
            data: req.session,
        });

        /*const authToken = jwt.sign(
                {userId: user.id, email: user.email},
                process.env.JWT_SECRET,
                {expiresIn: '7d'}
            );
    
            res.cookie('authToken', authToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000  // 7 dana
            });
            
            console.log('✅ JWT kreiran:', authToken.substring(0, 20) + '...');*/
        
            const businesses = await UserBusiness.getUserBusinesses(user.id);
            let redirectTo = "/";
            let activeBusinessId = null;
            let userRole = null;

        if (businesses.length === 0) {
            redirectTo = "/onboarding";
        } else if (businesses.length === 1) {
            activeBusinessId = Number(businesses[0].business_id);
            userRole = businesses[0].role;
            req.session.activeBusinessId = activeBusinessId;
            req.session.role = userRole;
            redirectTo = (userRole === 'owner' || userRole === 'admin') ? "/dashboard" : "/appointments";
        } else if (businesses.length > 1) {
            redirectTo = "/my-businesses";
        }

        req.session.save((err) => {
            if (err) return next(err);
            return res.status(200).json({
                success: true,
                message: "Uspješno ste se prijavili",
                user: {
                    id: user.id,
                    email: user.email,
                    verificationLevel: user.verification_level,
                    activeBusinessId,
                    role: userRole
                },
                redirectTo
            });
        });
    } catch (error) {
        next(error);
    }
}

export async function checkSession(req, res, next){
    try {
    // authMiddleware već provjerio session i postavio req.user
    const user = await User.getByUserId(req.user.id);
    const businesses = await UserBusiness.getUserBusinesses(user.id);

    // Get flash messages if any
    const flash = req.session.flash;
    if (flash) {
        delete req.session.flash;
    }

    const activeBusinessId = req.session.activeBusinessId || null;
    const currentBusiness = businesses.find(b => b.business_id === activeBusinessId);
    const userRole = currentBusiness ? currentBusiness.role : null;

    return res.status(200).json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        verificationLevel: user.verification_level,
        hasBusinesses: businesses.length > 0,
        activeBusinessId: activeBusinessId ? Number(activeBusinessId) : null,
        role: userRole
      },
      flash: flash || null,
      businesses: businesses,
      redirectTo: businesses.length === 0 ? '/onboarding' : null
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
    try {
        req.session.destroy((err) => {
            if (err) return next(err);
            res.clearCookie("connect.sid", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
            });
        });
    } catch (error) {
        next(error);
    }
}
