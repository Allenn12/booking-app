import pool from '../config/database.js';
import { ERRORS } from '../utils/errors.js';
import crypto from 'crypto';
import { hashVerificationToken } from '../script/hashVerificationToken.js';

export const User = {
    getByUserId: async(userId)=>{
        try{
            const sql = 'SELECT * from User where id = ?';
            const [rows] = await pool.query(sql, [userId]);
            return rows[0];
        }
        catch(error){
        if (error.code === 'PROTOCOL_CONNECTION_LOST') {
            throw ERRORS.DATABASE('Greška pri povezivanju s bazom podataka');
        }

        if (error.code === 'ER_PARSE_ERROR') {
            throw ERRORS.DATABASE('Greška u SQL upitu');
        }
  
        throw ERRORS.DATABASE(`Greška pri pronalaženju korisnika: ${error.message}`)
        }
    },
    findByEmail: async(email)=>{
        try{
            const sql = 'SELECT * from User where email = ?';
            const [rows] = await pool.query(sql, [email]);
            return rows[0];
        }
        catch(error){
        if (error.code === 'PROTOCOL_CONNECTION_LOST') {
            throw ERRORS.DATABASE('Greška pri povezivanju s bazom podataka');
        }

        if (error.code === 'ER_PARSE_ERROR') {
            throw ERRORS.DATABASE('Greška u SQL upitu');
        }
  
        throw ERRORS.DATABASE(`Greška pri pronalaženju korisnika: ${error.message}`)
        }
    },
    findByPhone: async(phone)=>{
        try{
            const sql = 'SELECT * FROM User where phone_number = ?';
            const [rows] = await pool.query(sql, [phone]);
            return rows[0];
        }
        catch(error){
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Greška pri povezivanju s bazom podataka');
            }

            if (error.code === 'ER_PARSE_ERROR') {
                throw ERRORS.DATABASE('Greška u SQL upitu');
            }
    
            throw ERRORS.DATABASE(`Greška pri pronalaženju korisnika: ${error.message}`)
        }
    },

    create: async (userData)=>{
        try{        
            const { 
            first_name, 
            last_name, 
            email, 
            hashedPassword, 
            phone_number, 
            business_name, 
            job_id, 
            country_id,
            
          } = userData;
            const sql = 
            `INSERT INTO user (first_name, last_name, business_name,email, password,phone_number, country_id, job_id) 
            VALUES (?,?,?,?,?,?,?,?)`;
    
            const [result] = await pool.query(sql, [first_name, last_name,business_name, email, hashedPassword, phone_number , country_id,job_id]);
            console.log('USER KREIRAN, ID:',result.insertId);
            return result;
        }
        catch(error){
            console.error('GREŠKA PRILIKOM KREIRANJA KORISNIKA');
            throw ERRORS.DATABASE(`Greška pri kreiranju korisnika: ${error.message}`);
        }
    },

    updateVerificationLevel: async(userId, verificationLevel) =>{
        const userExists = await User.getByUserId(userId);
        if(!userExists){
            throw ERRORS.NOT_FOUND('Korisnik nije pronađen!');
        }
        try{

            const sql = 'UPDATE User SET verification_level = ?, updated_at = NOW() WHERE id = ?';
            const [result] = await pool.query(sql, [verificationLevel,userId]);
            return result.length !== 0 ?  true : false;
   
        }
        catch(error){
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Greška pri povezivanju s bazom podataka');
            }

            if (error.code === 'ER_PARSE_ERROR') {
                throw ERRORS.DATABASE('Greška u SQL upitu');
            }
    
            throw ERRORS.DATABASE(`Greška pri ažuriranju korisnika: ${error.message}`)
        }
    },

    saveVerificationCode: async(data)=>{
        try{
            const {user_id, code, code_type, expires_at} = data;
            const sql = `INSERT INTO verification_codes(user_id, code, code_type, expires_at VALUES (?, ?, ?, ?)`;

        }
        catch(error){

        }
    },
    generateAndSaveVerificationToken: async(userId,email, tokenType)=>{
        try{
            const token = crypto.randomBytes(32).toString('hex');
            const hashedToken = hashVerificationToken(token);
            const expiresAt = new Date(Date.now() + 24*60*60*1000); // 24 sata
            const sql = `INSERT INTO verification_tokens(user_id, email, token_hash, token_type, expires_at) VALUES (?, ?, ?, ?, ?)`;
            const [result] = await pool.query(sql, [userId, email, hashedToken, tokenType, expiresAt])
            return {
                id: result.insertId,
                token: token,
                expiresAt: expiresAt
            }
        }
        catch(error){
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Greška pri povezivanju s bazom podataka');
            }

            if (error.code === 'ER_PARSE_ERROR') {
                throw ERRORS.DATABASE('Greška u SQL upitu');
            }
    
            throw ERRORS.DATABASE(`Greška pri spremanju verifikacijskog tokena: ${error.message}`)
        }
    },
    getVerificationToken: async (token, email)=>{
        try{
            const hashedToken = hashVerificationToken(token);
            const sql = `
                SELECT * FROM verification_tokens
                WHERE token_hash = ?
                AND email = ?
                AND is_used = 0
                AND expires_at > NOW()
                LIMIT 1
            `;
            const [result] = await pool.query(sql, [hashedToken, email]);
            if(result.length === 0){
                return null;
            }
            return result[0];   
        }
        catch(error){
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Greška pri povezivanju s bazom podataka');
            }

            if (error.code === 'ER_PARSE_ERROR') {
                throw ERRORS.DATABASE('Greška u SQL upitu');
            }
    
            throw ERRORS.DATABASE(`Greška pri dohvaćanju verifikacijskog koda: ${error.message}`)
        }
    },
    markVerificationTokenAsUsed: async(id)=>{
        try{
            const sql = `UPDATE verification_tokens SET is_used = 1, used_at = NOW() WHERE id = ?`
            const [result] = await pool.query(sql, [id]);
            return result.length !== 0 ? true:false;
        }
        catch(error){
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Greška pri povezivanju s bazom podataka');
            }

            if (error.code === 'ER_PARSE_ERROR') {
                throw ERRORS.DATABASE('Greška u SQL upitu');
            }
    
            throw ERRORS.DATABASE(`Greška pri ažuriranju verifikacijskog koda: ${error.message}`)
        }
    },
    invalidateOldTokens: async(userId, tokenType)=>{
        try{
            const sql = `UPDATE verification_tokens 
                        SET is_used = 1, used_at = NOW() 
                        WHERE user_id = ? 
                        AND token_type = ? 
                        AND is_used = 0`
            
            const [result] = await pool.query(sql, [userId, tokenType]);
            return result;
        }
        catch(error){
            if (error.code === 'PROTOCOL_CONNECTION_LOST') {
                throw ERRORS.DATABASE('Greška pri povezivanju s bazom podataka');
            }

            if (error.code === 'ER_PARSE_ERROR') {
                throw ERRORS.DATABASE('Greška u SQL upitu');
            }
            if(error.code === 'DUPLICATE_ENTRY'){
                throw ERRORS.DATABASE('Trenutno nije moguće poslati novi verifikacijski link');
            }
            throw ERRORS.DATABASE(`Greška pri ažuriranju verifikacijskog koda: ${error.message}`)
        }

    }

};

export default User;