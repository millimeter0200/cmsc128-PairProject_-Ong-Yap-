# cmsc128-PairProject_-Ong-Yap-

I. Backend
- Our project uses Flask (a Python web framework) together with SQLAlchemy for handling database operations. SQLite is used for local development, while the app is also compatible with PostgreSQL for deployment by using the DATABASE_URL environment variable.
  
The backend supports:
• User authentication (login, register, logout, password reset, password change)
• Personal to-do lists
• Collaborative to-do lists shared with multiple users
• Task sorting by date added, due date, or priority
• Secure session handling with no browser history leakage after logout
• Email sending for password reset using Flask-Mail

II. How to Run the Web App Locally
1. Open the project folder where app.py is located.
2. Create a virtual environment: python -m venv venv
3. Activate the virtual environment:
   Windows:
    venv\Scripts\activate
   Mac/Linux:
    source venv/bin/activate
4. Install all required packages: pip install -r requirements.txt
5. Create a .env file inside the project folder with the following entries:
    SECRET_KEY = your-secret-key
    MAIL_USERNAME = your gmail address
    MAIL_PASSWORD = your Gmail App Password
    DATABASE_URL = sqlite:///todo.db
6. Run the Flask app: python app.py
7. Open your browser and go to: http://127.0.0.1:5000

III. Example API Endpoints
1. AUTHENTICATION ENDPOINTS
POST /accounts/register
Registers a new user.

POST /accounts/login
Logs a user into the system.

POST /accounts/logout
Logs the user out and clears the session.

GET /accounts/whoami
Returns the current authenticated user.

PUT /accounts/profile
Updates the user’s profile information.

POST /accounts/change_password
Changes the user's password after verifying the current one.

POST /accounts/forgot
Sends a password reset code to the email.

POST /accounts/reset
Resets a user's password using the code.

2. PERSONAL TASK ENDPOINTS
GET /tasks
Returns all personal tasks that belong to the logged-in user.
Supports sorting by:
• added
• due
• priority

POST /add
Creates a new personal task.
Example JSON:
{
"title": "Do homework",
"due_date": "2025-01-20",
"due_time": "14:00",
"priority": "High"
}

PUT /update/<id>
Updates an existing task.

DELETE /delete/<id>
Deletes a personal task by ID.

3. COLLABORATIVE LIST ENDPOINTS

GET /collab/lists
Returns all collaborative lists where the user is:
• The owner
• A collaborator added by someone else

POST /collab/create
Creates a new collaborative list.

PUT /collab/<list_id>/rename
Renames a collaborative list.

DELETE /collab/<list_id>/delete
Deletes a collaborative list including its members and tasks.

POST /collab/<list_id>/add_member
Adds another user to the collaborative list.

POST /collab/<list_id>/remove_member
Removes a collaborator.

GET /collab/<list_id>/members
Returns the list of members and indicates whether the current user is the owner.

4. COLLABORATIVE TASK ENDPOINTS

GET /collab/<list_id>/tasks
Returns all tasks inside the selected collaborative list.

POST /collab/<list_id>/add_task
Adds a task to a collaborative list.

PUT /collab_task/<task_id>
Updates a collaborative task.

DELETE /collab/<list_id>/delete_task/<task_id>
Deletes a collaborative task.

IV. Security Measures
The app uses session-based authentication. To prevent the previous user’s account from appearing after logout when clicking the browser’s back button, every response includes headers that block caching:

The system sends:
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
Pragma: no-cache
Expires: 0

This ensures the browser does not reuse cached protected pages when logged out.

V. Technologies Used

Backend: Flask, SQLAlchemy
Database: SQLite (local), PostgreSQL (deployment)
Email: Flask-Mail with Gmail SMTP
Frontend: HTML, CSS, JavaScript
Authentication: Secure Sessions
