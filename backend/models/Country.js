import pool from "../config/database.js";
import { ERRORS } from "../utils/errors.js";

export const Country = {
  getAll: async () => {
    try {
      const sql = "SELECT * FROM country WHERE active = TRUE ORDER BY name ASC";
      const [rows] = await pool.query(sql);
      return rows;
    } catch (error) {
      if (error.code === "PROTOCOL_CONNECTION_LOST") {
        throw new DatabaseError("Greška pri povezivanju s bazom podataka");
      }

      if (error.code === "ER_PARSE_ERROR") {
        throw new DatabaseError("Greška u SQL upitu");
      }

      throw new DatabaseError(
        `Greška pri pronalaženju aktivnih država: ${error.message}`,
      );
    }
  },

  getByCode: async (country_code) => {
    try {
        const sql =
            "SELECT * from country WHERE country_code = ? and active = TRUE";
        const [rows] = await pool.query(sql, [country_code]);
        return rows[0];
    } catch (error) {
        throw ERRORS.DATABASE(`Greška: ${error.message}`);
    }
  },
};

export default Country;