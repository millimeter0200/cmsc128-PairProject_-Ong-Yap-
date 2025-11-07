from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from werkzeug.security import generate_password_hash, check_password_hash
import random, string

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///todo.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'dev-secret-key-change-me'

db = SQLAlchemy(app)

# ---------------- TASK MODEL ----------------
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # link to User
    title = db.Column(db.String(200), nullable=False)
    due_date = db.Column(db.String(100), nullable=True)
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


# ---------------- USER MODEL ----------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    password_hash = db.Column(db.String(300), nullable=False)
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

with app.app_context():
    db.create_all()

# ---------------- ROUTES ----------------
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/accounts')
def accounts_page():
    return render_template('accounts.html')

# ---------- AUTH HELPERS ----------
def get_current_user():
    uid = session.get('user_id')
    if not uid: return None
    return User.query.get(uid)

# ---------- REGISTER ----------
@app.route('/accounts/register', methods=['POST'])
def accounts_register():
    data = request.json or {}
    username = (data.get('username') or '').strip().lower()
    password = data.get('password') or ''
    name = (data.get('name') or '').strip()
    if not username or not password or not name:
        return jsonify({"error": "All fields required"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken"}), 409
    user = User(username=username, name=name)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "Account created"}), 201

# ---------- LOGIN ----------
@app.route('/accounts/login', methods=['POST'])
def accounts_login():
    data = request.json or {}
    username = (data.get('username') or '').strip().lower()
    password = data.get('password') or ''
    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401
    session['user_id'] = user.id
    session['username'] = user.username
    return jsonify({"message": "Logged in", "user": user.to_safe_dict()})

# ---------- LOGOUT ----------
@app.route('/accounts/logout', methods=['POST'])
def accounts_logout():
    session.pop('user_id', None)
    session.pop('username', None)
    return jsonify({"message": "Logged out"})

# ---------- PROFILE ----------
@app.route('/accounts/profile', methods=['GET'])
def accounts_profile():
    user = get_current_user()
    if not user: return jsonify({"error": "Not authenticated"}), 401
    return jsonify({"user": user.to_safe_dict()})

@app.route('/accounts/profile', methods=['PUT'])
def accounts_profile_update():
    user = get_current_user()
    if not user: return jsonify({"error": "Not authenticated"}), 401
    data = request.json or {}
    new_name = (data.get('name') or '').strip()
    new_username = (data.get('username') or '').strip().lower()
    if new_username and new_username != user.username:
        if User.query.filter_by(username=new_username).first():
            return jsonify({"error": "Username already taken"}), 409
        user.username = new_username
        session['username'] = new_username
    if new_name: user.name = new_name
    db.session.commit()
    return jsonify({"message": "Profile updated"})

# ---------- CHANGE PASSWORD ----------
@app.route('/accounts/change_password', methods=['POST'])
def accounts_change_password():
    user = get_current_user()
    if not user: return jsonify({"error": "Not authenticated"}), 401
    data = request.json or {}
    current = data.get('current_password') or ''
    newpw = data.get('new_password') or ''
    if not user.check_password(current):
        return jsonify({"error": "Incorrect password"}), 403
    user.set_password(newpw)
    db.session.commit()
    return jsonify({"message": "Password changed"})

# ---------- FORGOT PASSWORD ----------
# Forgot password: generate short 6-character token and log it to console (simulate email)
@app.route('/accounts/forgot', methods=['POST'])
def accounts_forgot():
    data = request.json or {}
    username = (data.get('username') or '').strip().lower()
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"error": "No such account"}), 404

    # Short, user-friendly OTP (letters + numbers)
    import random, string
    token = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))

    expiry = datetime.utcnow() + timedelta(minutes=20)
    user.reset_token = token
    user.reset_token_expiry = expiry
    db.session.commit()

    # Simulate "sending email" by printing to server console
    print(f"\n📧 [SIMULATED EMAIL] Password reset code for '{username}': {token}\n")

    # Respond vaguely (so it looks realistic)
    return jsonify({
        "message": "A password reset code has been sent to your registered email. (Check console for demo.)"
    })


# ---------- RESET PASSWORD ----------
@app.route('/accounts/reset', methods=['POST'])
def accounts_reset():
    data = request.json or {}
    username = (data.get('username') or '').strip().lower()
    token = (data.get('token') or '').strip()
    newpw = data.get('new_password') or ''
    user = User.query.filter_by(username=username).first()
    if not user or user.reset_token != token:
        return jsonify({"error": "Invalid token or username"}), 403
    if user.reset_token_expiry < datetime.utcnow():
        return jsonify({"error": "Token expired"}), 403
    user.set_password(newpw)
    user.reset_token = None
    user.reset_token_expiry = None
    db.session.commit()
    return jsonify({"message": "Password reset successful"})

# ---------- WHOAMI ----------
@app.route('/accounts/whoami', methods=['GET'])
def accounts_whoami():
    user = get_current_user()
    if not user:
        return jsonify({"authenticated": False})
    return jsonify({"authenticated": True, "user": user.to_safe_dict()})

# ---------------- TASK ROUTES ----------------
from sqlalchemy import case

def ensure_login():
    user_id = session.get("user_id")
    if not user_id:
        return None, (jsonify({"error": "Not authenticated"}), 401)
    user = User.query.get(user_id)
    return user, None


@app.route("/tasks", methods=["GET"])
def get_tasks():
    user, err = ensure_login()
    if err:
        return err

    sort = request.args.get("sort", "added")
    if sort == "due":
        order_by = Task.due_date.asc()
    elif sort == "priority":
        order_by = case(
            (Task.priority == "High", 1),
            (Task.priority == "Mid", 2),
            (Task.priority == "Low", 3)
        )
    else:
        order_by = Task.date_added.desc()

    tasks = Task.query.filter_by(user_id=user.id).order_by(order_by).all()
    return jsonify([t.to_dict() for t in tasks])


@app.route("/add", methods=["POST"])
def add_task():
    user, err = ensure_login()
    if err:
        return err

    data = request.json or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title required"}), 400

    due_date = (data.get("due_date") or "").strip()
    due_time = (data.get("due_time") or "").strip()
    if due_date and due_time:
        due_date = f"{due_date} {due_time}"

    task = Task(
        user_id=user.id,
        title=title,
        due_date=due_date if due_date else None,
        priority=data.get("priority", "Mid")
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({"message": "Task added"}), 201


@app.route("/update/<int:id>", methods=["PUT"])
def update_task(id):
    user, err = ensure_login()
    if err:
        return err

    task = Task.query.filter_by(id=id, user_id=user.id).first()
    if not task:
        return jsonify({"error": "Task not found"}), 404

    data = request.json or {}
    if "title" in data:
        task.title = data["title"]
    if "priority" in data:
        task.priority = data["priority"]
    if "due_date" in data or "due_time" in data:
        due_date = (data.get("due_date") or "").strip()
        due_time = (data.get("due_time") or "").strip()
        if due_date and due_time:
            task.due_date = f"{due_date} {due_time}"
        elif due_date:
            task.due_date = due_date
    if "done" in data:
        task.done = bool(data["done"])
    db.session.commit()
    return jsonify({"message": "Task updated"})


@app.route("/delete/<int:id>", methods=["DELETE"])
def delete_task(id):
    user, err = ensure_login()
    if err:
        return err

    task = Task.query.filter_by(id=id, user_id=user.id).first()
    if not task:
        return jsonify({"error": "Task not found"}), 404

    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task deleted"})


if __name__ == '__main__':
    app.run(debug=True)

