import express from "express";
import Country from "../../models/Country.js";
import { ERRORS } from "../../utils/errors.js";
const router = express.Router();

router.get("/", async (req, res, next) => {
    try {
        const countries = await Country.getAll();
        res.json({ success: true, data: countries });
    }
    catch (error){
        next(error);
    }
});

router.get("/:code", async (req, res, next) => {
    try {
        const country = await Country.getByCode(req.params.code);
        res.json({ success: true, country });
    } catch (error) {
        next(error);
    }
});

export default router;
