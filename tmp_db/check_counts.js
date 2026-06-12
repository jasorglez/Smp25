import sql from "mssql";
import dotenv from "dotenv";

dotenv.config({ path: "/Users/alextellezvazquez/mcp-sqlserver/.env" });

async function run() {
  try {
    const pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      port: Number(process.env.DB_PORT),
      database: "warehouses",
      options: { encrypt: true, trustServerCertificate: true }
    });

    const checkQuery = `
      SELECT oc.id_req, COUNT(oc.id) as count
      FROM Ocandreq oc
      INNER JOIN Detailsreqoc d ON oc.id = d.id_movement
      WHERE oc.active = 1
        AND oc.type = 'OC'
        AND oc.id_req IN (727)
        AND d.id_supplie = 3023
        AND d.active = 1
      GROUP BY oc.id_req
    `;
    const checkResult = await pool.request().query(checkQuery);
    console.table(checkResult.recordset);
    
    await pool.close();
  } catch (err) {
    console.error("Error SQL:", err.message);
  }
}

run();
