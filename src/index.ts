import 'reflect-metadata';
import { mainDataSource, auditLogDataSource } from './config/database.config';

// Function to initialize the application
async function initializeApp() {
  try {
    // Initialize the main database
    await mainDataSource.initialize();
    console.log('Main database connected');

    // Initialize the audit log database
    await auditLogDataSource.initialize();
    console.log('Audit log database connected');

    // Additional initialization logic can be placed here if needed

  } catch (error) {
    console.error('Error initializing databases:', error);
    process.exit(1); // Exit the process with an error code
  }
}

// Start the application
initializeApp().then(() => {
  // Import and start the main application after initializing databases
  const app = require('./app').default;
  
  // Assuming app is the Express application
  const port = process.env.PORT || 3002;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});
