import pool from '../../config/database.js';

export const JobController = {
  // GET /api/v1/jobs
  getAll: async (req, res, next) => {
    try {
      const sql = 'SELECT id, name, description FROM job ORDER BY name ASC';
      const [jobs] = await pool.query(sql);

      res.status(200).json({
        success: true,
        data: jobs
      });
    } catch (error) {
      next(error);
    }
  }
};

export default JobController;
