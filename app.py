# ============================
# ===== PART 1 — IMPORTS =====
# ============================

from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from werkzeug.security import generate_password_hash, check_password_hash
from flask_mail import Mail, Message
from sqlalchemy import case

import random
import string



app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///todo.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'dev-secret-key-change-me'

db = SQLAlchemy(app)

# ============================
# ===== MAIL CONFIG ==========
# ============================

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USE_SSL'] = False
app.config['MAIL_USERNAME'] = 'yapmaemaricar@gmail.com'
app.config['MAIL_PASSWORD'] = 'varq vhhx lrfb rhut'
app.config['MAIL_DEFAULT_SENDER'] = ('My ToDo App', 'your_email@gmail.com')

mail = Mail(app)

# ============================
# ===== USER MODEL ===========
# ============================

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
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
            "email": self.email,
            "date_created": self.date_created.strftime("%m-%d-%Y %I:%M %p")
        }


# ============================
# ===== PERSONAL TASK MODEL ==
# ============================

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    due_date = db.Column(db.String(100), nullable=True)
    priority = db.Column(db.String(10), default="Mid")
    date_added = db.Column(db.DateTime, default=datetime.utcnow)
    done = db.Column(db.Boolean, default=False)

    def to_dict(self):
        # Split due_date into date + time
        due_date_only = ""
        due_time_only = ""

        if self.due_date:
            parts = self.due_date.split(" ")
            if len(parts) >= 1:
                due_date_only = parts[0]
            if len(parts) >= 2:
                due_time_only = parts[1]

        return {
            "id": self.id,
            "title": self.title,
            "due_date": due_date_only,
            "due_time": due_time_only,
            "priority": self.priority,
            "done": self.done,
            "date_added": self.date_added.strftime("%Y-%m-%d %H:%M") if self.date_added else ""
        }



# ============================
# ===== COLLAB MODELS ========
# ============================

class CollabList(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class CollabMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey('collab_list.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)


class CollabTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey('collab_list.id'), nullable=False)

    title = db.Column(db.String(200), nullable=False)

    # ✨ NEW CLEAN FORMAT:
    # due_date stores BOTH date and time → "YYYY-MM-DD HH:MM"
    due_date = db.Column(db.String(100), nullable=True)

    priority = db.Column(db.String(10), default="Mid")
    date_added = db.Column(db.DateTime, default=datetime.utcnow)
    done = db.Column(db.Boolean, default=False)

    def to_dict(self):

        # convert date_added to Manila time
        dt = self.date_added
        if dt and dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        added_str = dt.astimezone(ZoneInfo("Asia/Manila")).strftime("%m-%d-%Y %I:%M %p") if dt else ""

        # format due_date
        formatted_due = self.due_date
        if self.due_date:
            try:
                if len(self.due_date.strip()) == 10:
                    d = datetime.strptime(self.due_date, "%Y-%m-%d")
                    formatted_due = d.strftime("%m-%d-%Y")
                else:
                    d = datetime.strptime(self.due_date, "%Y-%m-%d %H:%M")
                    formatted_due = d.strftime("%m-%d-%Y %I:%M %p")
            except:
                pass

        return {
            "id": self.id,
            "list_id": self.list_id,
            "title": self.title,
            "due_date": formatted_due,
            "priority": self.priority,
            "done": self.done,
            "date_added": added_str
        }


with app.app_context():
    db.create_all()


# ============================
# ===== AUTH HELPERS =========
# ============================

def get_current_user():
    uid = session.get('user_id')
    if not uid:
        return None
    return db.session.get(User, uid)


def ensure_login():
    user_id = session.get("user_id")
    if not user_id:
        return None, (jsonify({"error": "Not authenticated"}), 401)
    user = db.session.get(User, user_id)
    return user, None


# ============================
# ===== PUBLIC ROUTES ========
# ============================

@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.route('/')
def welcome():
    if session.get('user_id'):
        return render_template('index.html')
    return render_template('welcome.html')


@app.route('/accounts')
def accounts_page():
    if not session.get("user_id"):
        return render_template("accounts.html")  # Show login page
    return render_template("accounts.html")      # JS will show profile after whoami


# ============================
# ===== REGISTER =============
# ============================

@app.route('/accounts/register', methods=['POST'])
def accounts_register():
    data = request.json or {}
    name = (data.get('name') or '').strip()
    username = (data.get('username') or '').strip().lower()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not name or not username or not email or not password:
        return jsonify({"error": "Fill all fields"}), 400

    # Check duplicates
    if User.query.filter(
        (User.username == username) | (User.email == email)
    ).first():
        return jsonify({"error": "Username or email already exists"}), 400

    user = User(
        name=name,
        username=username,
        email=email,
        password_hash=generate_password_hash(password)
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({"success": True})


# ============================
# ===== LOGIN / LOGOUT =======
# ============================

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


@app.route('/accounts/logout', methods=['POST'])
def accounts_logout():
    session.pop('user_id', None)
    session.pop('username', None)
    return jsonify({"message": "Logged out"})


# ============================
# ===== PROFILE ROUTES =======
# ============================

@app.route('/accounts/profile', methods=['GET'])
def accounts_profile():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({"user": user.to_safe_dict()})


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
    return jsonify({"message": "Profile updated"})


# ============================
# ===== CHANGE PASSWORD ======
# ============================

@app.route('/accounts/change_password', methods=['POST'])
def accounts_change_password():
    user = get_current_user()
    if not user:
        return jsonify({"error": "Not authenticated"}), 401

    data = request.json or {}
    current_pw = data.get('current_password') or ''
    new_pw = data.get('new_password') or ''

    if not user.check_password(current_pw):
        return jsonify({"error": "Incorrect password"}), 403

    user.set_password(new_pw)
    db.session.commit()
    return jsonify({"message": "Password changed"})


# ============================
# ===== FORGOT PASSWORD ======
# ============================

@app.route('/accounts/forgot', methods=['POST'])
def accounts_forgot():
    data = request.json or {}
    username = (data.get('username') or '').strip().lower()

    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"error": "No such account"}), 404

    token = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    expiry = datetime.utcnow() + timedelta(minutes=20)

    user.reset_token = token
    user.reset_token_expiry = expiry
    db.session.commit()

    try:
        msg = Message(
            subject="Password Reset Code",
            recipients=[user.email],
            body=(
                f"Hello {user.name},\n\n"
                f"Your password reset code is: {token}\n"
                f"This code will expire in 20 minutes."
            )
        )
        mail.send(msg)

    except Exception as e:
        print("Mail error:", e)
        return jsonify({"error": "Failed to send email"}), 500

    return jsonify({"message": "Reset code sent"})


# ============================
# ===== RESET PASSWORD =======
# ============================

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


# ============================
# ===== WHOAMI ===============
# ============================

@app.route('/accounts/whoami', methods=['GET'])
def accounts_whoami():
    user = get_current_user()
    if not user:
        return jsonify({"authenticated": False})

    return jsonify({
        "authenticated": True,
        "user": user.to_safe_dict()
    })


# ============================
# ===== PERSONAL TASKS =======
# ============================

@app.route("/tasks", methods=["GET"])
def get_tasks():
    user, err = ensure_login()
    if err:
        return err

    sort = request.args.get("sort", "added")

    if sort == "due":
        order = Task.due_date.asc()
    elif sort == "priority":
        order = case(
            (Task.priority == "High", 1),
            (Task.priority == "Mid", 2),
            (Task.priority == "Low", 3)
        )
    else:
        order = Task.date_added.desc()

    tasks = Task.query.filter_by(user_id=user.id).order_by(order).all()
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
        date = (data.get("due_date") or "").strip()
        time = (data.get("due_time") or "").strip()

        if date and time:
            task.due_date = f"{date} {time}"
        elif date:
            task.due_date = date

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


@app.route('/todo')
def todo_page():
    if not session.get('user_id'):
        return render_template('accounts.html')
    return render_template('index.html')

# ============================
# ===== COLLAB ROUTES ========
# ============================

@app.route('/collab')
def collab_page():
    if not session.get('user_id'):
        return render_template('accounts.html')
    return render_template('collab.html')


# ----------------------------
# Helper: Check if user has permission
# ----------------------------

def collab_user_allowed(list_id):
    """Return list object if user is owner or collaborator."""
    uid = session.get("user_id")
    if not uid:
        return None

    cl = CollabList.query.filter_by(id=list_id).first()
    if not cl:
        return None

    if cl.owner_id == uid:
        return cl

    member = CollabMember.query.filter_by(list_id=list_id, user_id=uid).first()
    if member:
        return cl

    return None


# ============================
# ===== GET LISTS FOR USER ===
# ============================

@app.route('/collab/lists', methods=['GET'])
def get_collab_lists():
    user, err = ensure_login()
    if err:
        return err

    owned_lists = CollabList.query.filter_by(owner_id=user.id).all()
    member_links = CollabMember.query.filter_by(user_id=user.id).all()

    member_lists = []
    for m in member_links:
        l = CollabList.query.filter_by(id=m.list_id).first()
        if l:
            member_lists.append(l)

    final = []
    for l in owned_lists + member_lists:
        owner = db.session.get(User, l.owner_id)
        final.append({
            "id": l.id,
            "name": l.name,
            "owner_username": owner.username
        })

    return jsonify({"lists": final})


# ============================
# ===== CREATE LIST ==========
# ============================

@app.route('/collab/create', methods=['POST'])
def create_collab_list():
    user, err = ensure_login()
    if err:
        return err

    data = request.json or {}
    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({"error": "List name required"}), 400

    new_list = CollabList(name=name, owner_id=user.id)
    db.session.add(new_list)
    db.session.commit()

    return jsonify({"message": "List created", "id": new_list.id}), 201


# ============================
# ===== RENAME LIST ==========
# ============================

@app.route('/collab/<int:list_id>/rename', methods=['PUT'])
def rename_collab_list(list_id):
    user, err = ensure_login()
    if err:
        return err

    data = request.json or {}
    new_name = (data.get("name") or "").strip()

    if not new_name:
        return jsonify({"error": "Name required"}), 400

    cl = CollabList.query.filter_by(id=list_id, owner_id=user.id).first()
    if not cl:
        return jsonify({"error": "Only owner can rename this list"}), 403

    cl.name = new_name
    db.session.commit()
    return jsonify({"message": "Renamed"})


# ============================
# ===== DELETE LIST ==========
# ============================

@app.route('/collab/<int:list_id>/delete', methods=['DELETE'])
def delete_collab_list(list_id):
    user, err = ensure_login()
    if err:
        return err

    cl = CollabList.query.filter_by(id=list_id, owner_id=user.id).first()
    if not cl:
        return jsonify({"error": "Only owner can delete"}), 403

    CollabTask.query.filter_by(list_id=list_id).delete()
    CollabMember.query.filter_by(list_id=list_id).delete()

    db.session.delete(cl)
    db.session.commit()
    return jsonify({"message": "Deleted"})


# ============================
# ===== ADD COLLABORATOR =====
# ============================

@app.route('/collab/<int:list_id>/add_member', methods=['POST'])
def add_collaborator(list_id):
    user, err = ensure_login()
    if err:
        return err

    cl = CollabList.query.filter_by(id=list_id, owner_id=user.id).first()
    if not cl:
        return jsonify({"error": "Only owner can add collaborators"}), 403

    data = request.json or {}
    username = (data.get("username") or "").strip().lower()

    target = User.query.filter_by(username=username).first()
    if not target:
        return jsonify({"error": "User not found"}), 404

    exists = CollabMember.query.filter_by(list_id=list_id, user_id=target.id).first()
    if exists:
        return jsonify({"error": "Already added"}), 409

    new = CollabMember(list_id=list_id, user_id=target.id)
    db.session.add(new)
    db.session.commit()

    return jsonify({"message": "Collaborator added"})


# ============================
# ===== LIST MEMBERS =========
# ============================

@app.route('/collab/<int:list_id>/members', methods=['GET'])
def get_collab_members(list_id):
    cl = collab_user_allowed(list_id)
    if not cl:
        return jsonify({"error": "Not allowed"}), 403

    members = (
        db.session.query(User.username)
        .join(CollabMember, CollabMember.user_id == User.id)
        .filter(CollabMember.list_id == list_id)
        .all()
    )

    is_owner = (session.get('user_id') == cl.owner_id)

    return jsonify({
        "members": [m[0] for m in members],
        "is_owner": is_owner
    })


# ============================
# ===== REMOVE MEMBER ========
# ============================

@app.route('/collab/<int:list_id>/remove_member', methods=['POST'])
def remove_collaborator(list_id):
    user, err = ensure_login()
    if err:
        return err

    cl = CollabList.query.filter_by(id=list_id, owner_id=user.id).first()
    if not cl:
        return jsonify({"error": "Only owner can remove collaborators"}), 403

    data = request.json or {}
    username = (data.get("username") or "").strip().lower()

    target = User.query.filter_by(username=username).first()
    if not target:
        return jsonify({"error": "User not found"}), 404

    record = CollabMember.query.filter_by(list_id=list_id, user_id=target.id).first()
    if not record:
        return jsonify({"error": "User not collaborator"}), 404

    db.session.delete(record)
    db.session.commit()
    return jsonify({"message": "Removed"})


# ============================
# ===== GET TASKS ============
# ============================

@app.route('/collab/<int:list_id>/tasks', methods=['GET'])
def get_collab_tasks(list_id):
    cl = collab_user_allowed(list_id)
    if not cl:
        return jsonify({"error": "Not allowed"}), 403

    sort = request.args.get("sort", "added")

    if sort == "due":
        ordering = CollabTask.due_date.asc()
    elif sort == "priority":
        ordering = case(
            (CollabTask.priority == "High", 1),
            (CollabTask.priority == "Mid", 2),
            (CollabTask.priority == "Low", 3)
        )
    else:
        ordering = CollabTask.date_added.desc()

    tasks = CollabTask.query.filter_by(list_id=list_id).order_by(ordering).all()
    return jsonify([t.to_dict() for t in tasks])


# ============================
# ===== ADD TASK =============
# ============================

@app.route('/collab/<int:list_id>/add_task', methods=['POST'])
def add_collab_task(list_id):
    cl = collab_user_allowed(list_id)
    if not cl:
        return jsonify({"error": "Not allowed"}), 403

    data = request.json or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title required"}), 400

    due_date = (data.get("due_date") or "").strip()
    due_time = (data.get("due_time") or "").strip()

    full_due = None
    if due_date and due_time:
        full_due = f"{due_date} {due_time}"
    elif due_date:
        full_due = due_date

    t = CollabTask(
        list_id=list_id,
        title=title,
        due_date=full_due,
        priority=data.get("priority", "Mid")
    )
    db.session.add(t)
    db.session.commit()

    return jsonify({"message": "Task added", "id": t.id})


# ============================
# ===== UPDATE TASK ==========
# ============================

@app.route('/collab_task/<int:task_id>', methods=['PUT'])
def update_collab_task(task_id):
    task = CollabTask.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    cl = collab_user_allowed(task.list_id)
    if not cl:
        return jsonify({"error": "Not allowed"}), 403

    data = request.json or {}

    if "title" in data:
        task.title = data["title"]

    if "priority" in data:
        task.priority = data["priority"]

    if "due_date" in data or "due_time" in data:
        date = (data.get("due_date") or "").strip()
        time = (data.get("due_time") or "").strip()

        if date and time:
            task.due_date = f"{date} {time}"
        elif date:
            task.due_date = date

    if "done" in data:
        task.done = bool(data["done"])

    db.session.commit()
    return jsonify({"message": "Updated"})


# ============================
# ===== DELETE TASK ==========
# ============================

@app.route('/collab/<int:list_id>/delete_task/<int:task_id>', methods=['DELETE'])
def delete_collab_task(list_id, task_id):
    cl = collab_user_allowed(list_id)
    if not cl:
        return jsonify({"error": "Not allowed"}), 403

    task = CollabTask.query.filter_by(id=task_id, list_id=list_id).first()
    if not task:
        return jsonify({"error": "Task not found"}), 404

    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Deleted"})


# ============================
# ===== USERS FOR SEARCH =====
# ============================

@app.route('/accounts/users', methods=['GET'])
def accounts_users():
    user, err = ensure_login()
    if err:
        return err

    users = User.query.filter(User.id != user.id).all()
    return jsonify({"users": [{"id": u.id, "username": u.username} for u in users]})

@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


# ============================
# ===== RUN APP ==============
# ============================

if __name__ == '__main__':
    app.run(debug=True)
