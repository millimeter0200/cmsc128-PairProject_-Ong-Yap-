from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from werkzeug.security import generate_password_hash, check_password_hash
import secrets

app = Flask(__name__)
# keep your existing DB (it will store both Task and User tables)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///todo.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# session secret - set to a strong value for production
app.secret_key = 'dev-secret-key-change-me'

db = SQLAlchemy(app)

# ---------------------------
# Existing Task model (unchanged, used by Lab 1)
# ---------------------------
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    due_date = db.Column(db.String(100), nullable=True)   # store as "YYYY-MM-DD HH:MM" or "" 
    priority = db.Column(db.String(10), default="Mid")
    date_added = db.Column(db.DateTime, default=datetime.utcnow)
    done = db.Column(db.Boolean, default=False)

    def to_dict(self):
        dt = self.date_added
        if dt is None:
            date_str = None
        else:
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            manila = dt.astimezone(ZoneInfo("Asia/Manila"))
            date_str = manila.strftime("%m-%d-%Y %I:%M %p")

        due_formatted = self.due_date
        if self.due_date:
            try:
                if len(self.due_date.strip()) == 10:
                    d = datetime.strptime(self.due_date, "%Y-%m-%d")
                    due_formatted = d.strftime("%m-%d-%Y")
                else:
                    d = datetime.strptime(self.due_date, "%Y-%m-%d %H:%M")
                    due_formatted = d.strftime("%m-%d-%Y %I:%M %p")
            except:
                pass
        return {
            "id": self.id,
            "title": self.title,
            "due_date": due_formatted,
            "priority": self.priority,
            "date_added": date_str,
            "done": self.done
        }

# ---------------------------
# New: User model for Lab 2 (accounts)
# ---------------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False)  # can be email or username
    name = db.Column(db.String(200), nullable=False)
    password_hash = db.Column(db.String(300), nullable=False)
    # password reset token and expiry (for demo; in production use emailed tokens)
    reset_token = db.Column(db.String(200), nullable=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)
    date_created = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, plain):
        self.password_hash = generate_password_hash(plain)

    def check_password(self, plain):
        return check_password_hash(self.password_hash, plain)

    def to_safe_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "name": self.name,
            "date_created": self.date_created.strftime("%m-%d-%Y %I:%M %p")
        }

# create tables (Task + User)
with app.app_context():
    db.create_all()

# ---------------------------
# Routes: To-Do (unchanged)
# ---------------------------
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/tasks', methods=['GET'])
def get_tasks():
    sort = request.args.get("sort", "added")
    tasks = Task.query.all()
    if sort == "priority":
        order_map = {"High": 0, "Mid": 1, "Low": 2}
        tasks.sort(key=lambda t: order_map.get(t.priority, 3))
    elif sort == "due":
        def parse_due(t):
            if not t.due_date:
                return datetime.max
            for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d"):
                try:
                    return datetime.strptime(t.due_date, fmt)
                except:
                    continue
            return datetime.max
        tasks.sort(key=parse_due)
    else:
        tasks.sort(key=lambda t: t.date_added)
    return jsonify([task.to_dict() for task in tasks])

@app.route('/task/<int:id>', methods=['GET'])
def get_task(id):
    task = Task.query.get_or_404(id)
    return jsonify(task.to_dict())

@app.route('/add', methods=['POST'])
def add_task():
    data = request.json
    due_date_str = (data.get('due_date') or "").strip()
    due_time_str = (data.get('due_time') or "").strip()
    due_combined = f"{due_date_str} {due_time_str}".strip()
    new_task = Task(
        title=data['title'],
        due_date=due_combined or None,
        priority=data.get('priority', 'Mid')
    )
    db.session.add(new_task)
    db.session.commit()
    return jsonify(new_task.to_dict())

@app.route('/update/<int:id>', methods=['PUT'])
def update_task(id):
    task = Task.query.get_or_404(id)
    data = request.json
    task.title = data.get('title', task.title)
    due_date_str = data.get('due_date')
    due_time_str = data.get('due_time')
    if due_date_str is not None or due_time_str is not None:
        due_combined = f"{due_date_str or ''} {due_time_str or ''}".strip()
        task.due_date = due_combined or None
    task.priority = data.get('priority', task.priority)
    task.done = data.get('done', task.done)
    db.session.commit()
    return jsonify(task.to_dict())

@app.route('/delete/<int:id>', methods=['DELETE'])
def delete_task(id):
    task = Task.query.get_or_404(id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task deleted"})

# ---------------------------
# NEW: Accounts pages & API (Lab 2)
# ---------------------------

# Render the standalone accounts page (Lab 2)
@app.route('/accounts')
def accounts_page():
    return render_template('accounts.html')

# Helper: get current user from session
def get_current_user():
    uid = session.get('user_id')
    if not uid:
        return None
    return User.query.get(uid)

# Register endpoint
@app.route('/accounts/register', methods=['POST'])
def accounts_register():
    data = request.json or {}
    username = (data.get('username') or '').strip().lower()
    password = data.get('password') or ''
    name = (data.get('name') or '').strip()
    if not username or not password or not name:
        return jsonify({"error": "All fields are required"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken"}), 409
    user = User(username=username, name=name)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "Account created", "user": user.to_safe_dict()}), 201

# Login endpoint
@app.route('/accounts/login', methods=['POST'])
def accounts_login():
    data = request.json or {}
    username = (data.get('username') or '').strip().lower()
    password = data.get('password') or ''
    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401
    # set session
    session['user_id'] = user.id
    session['username'] = user.username
    return jsonify({"message": "Logged in", "user": user.to_safe_dict()})

# Logout endpoint
@app.route('/accounts/logout', methods=['POST'])
def accounts_logout():
    session.pop('user_id', None)
    session.pop('username', None)
    return jsonify({"message": "Logged out"})

# Profile (get current user info)
@app.route('/accounts/profile', methods=['GET'])
def accounts_profile():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({"user": user.to_safe_dict()})

# Update profile (change name or username)
@app.route('/accounts/profile', methods=['PUT'])
def accounts_profile_update():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.json or {}
    new_name = (data.get('name') or '').strip()
    new_username = (data.get('username') or '').strip().lower()
    if new_username and new_username != user.username:
        if User.query.filter_by(username=new_username).first():
            return jsonify({"error": "Username already taken"}), 409
        user.username = new_username
        session['username'] = new_username
    if new_name:
        user.name = new_name
    db.session.commit()
    return jsonify({"message": "Profile updated", "user": user.to_safe_dict()})

# Change password (authenticated) - requires current password
@app.route('/accounts/change_password', methods=['POST'])
def accounts_change_password():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.json or {}
    current = data.get('current_password') or ''
    newpw = data.get('new_password') or ''
    if not current or not newpw:
        return jsonify({"error": "Both current and new password required"}), 400
    if not user.check_password(current):
        return jsonify({"error": "Current password incorrect"}), 403
    user.set_password(newpw)
    db.session.commit()
    return jsonify({"message": "Password changed"})

# Forgot password: generate a reset token (for demo we return it to user)
@app.route('/accounts/forgot', methods=['POST'])
def accounts_forgot():
    data = request.json or {}
    username = (data.get('username') or '').strip().lower()
    user = User.query.filter_by(username=username).first()
    if not user:
        # do not reveal which usernames exist in production — but for demo return error
        return jsonify({"error": "No such account"}), 404
    token = secrets.token_urlsafe(16)
    expiry = datetime.utcnow() + timedelta(minutes=20)
    user.reset_token = token
    user.reset_token_expiry = expiry
    db.session.commit()
    # In production, email the token; here we return it in response for the grader/demo
    return jsonify({
        "message": "Reset token generated (demo). In real apps this would be emailed.",
        "reset_token": token,
        "expires_at_utc": expiry.isoformat()
    })

# Reset password using token
@app.route('/accounts/reset', methods=['POST'])
def accounts_reset():
    data = request.json or {}
    username = (data.get('username') or '').strip().lower()
    token = data.get('token') or ''
    newpw = data.get('new_password') or ''
    if not username or not token or not newpw:
        return jsonify({"error": "username, token, and new_password required"}), 400
    user = User.query.filter_by(username=username).first()
    if not user or not user.reset_token:
        return jsonify({"error": "Invalid token or user"}), 403
    if user.reset_token != token:
        return jsonify({"error": "Invalid token"}), 403
    if not user.reset_token_expiry or user.reset_token_expiry < datetime.utcnow():
        return jsonify({"error": "Token expired"}), 403
    user.set_password(newpw)
    user.reset_token = None
    user.reset_token_expiry = None
    db.session.commit()
    return jsonify({"message": "Password has been reset"})

# small helper endpoints for frontend convenience
@app.route('/accounts/whoami', methods=['GET'])
def accounts_whoami():
    user = get_current_user()
    if not user:
        return jsonify({"authenticated": False})
    return jsonify({"authenticated": True, "user": user.to_safe_dict()})

if __name__ == '__main__':
    app.run(debug=True)
