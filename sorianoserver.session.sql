USE administration;

/*SELECT *
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE' order BY TABLE_NAME desc; 

UPDATE td.ot
SET area = 'CORTES Ó RECONEXIONES'
WHERE area = 'CORTES Y RECONEXIONES'

select id, ot_number, cdc from td.ot order BY id desc 

select * from td.ot order BY id desc 

select * from td.ot where package='TAURINOT04 04 SEPTIEMBRE26' order BY id desc
*/

select * from customers where type='PROVIDERS' Order BY namecontact desc

