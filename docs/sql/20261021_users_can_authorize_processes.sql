use security;
IF COL_LENGTH('dbo.Users', 'canAuthorizeProcesses') IS NULL
BEGIN
    ALTER TABLE dbo.Users
        ADD canAuthorizeProcesses bit NOT NULL
            CONSTRAINT DF_Users_canAuthorizeProcesses DEFAULT (0) WITH VALUES;
END;


