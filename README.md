# cmsc128-PairProject_-Ong-Yap-

I. Backend
- We chose Flask (Python web framework) + SQLite database for our backend. This setup allows persistent task storage and is similar to how PHP works with MySQL, which we have prior experience with.

II. How to run the web app
1. First, make sure that you are in the right directory.
2. Next, set up the Python virtual environment and activate it typing the prompt "-m venv venv" followed by "venv\Scripts\activate" in the terminal.
3. Then, install the required packages if you haven’t yet using the prompt "pip install -r requirements.txt".
4. Once everything is installed and ctivated, start the web app by running "python ap.py" in the terminal.
6. The web app will now run on http://127.0.0.1:5000.
7. Finally, open http://127.0.0.1:5000 in your browser and start managing your tasks.

III. Example API Endpoints
1. Method: GET	Endpoint: /tasks	Description: "Get all tasks"
2. Method: GET	Endpoint: /tasks/<id>	Description: "Get a specific task by ID"
3. Method: POST	Endpoint: /tasks	Description: "Create a new task"
4. Method: PUT	Endpoint: /tasks/<id>	Description: "Update an existing task"
5. Method: DELETE	Endpoint: /tasks/<id>	Description: "Delete a task by ID"