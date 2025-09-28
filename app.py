from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///todo.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Task Model
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    due_date = db.Column(db.String(100), nullable=True)   # store as "YYYY-MM-DD HH:MM" or "" 
    priority = db.Column(db.String(10), default="Mid")
    date_added = db.Column(db.DateTime, default=datetime.utcnow)
    done = db.Column(db.Boolean, default=False)

    def to_dict(self):
        # Convert stored timestamp (assumed UTC if naive) to Asia/Manila
        dt = self.date_added
        if dt is None:
            date_str = None
        else:
            # if naive datetime (no tzinfo), assume it's UTC (what we used before)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            # Convert to Manila timezone
            manila = dt.astimezone(ZoneInfo("Asia/Manila"))
            date_str = manila.strftime("%Y-%m-%d %H:%M")
        return {
            "id": self.id,
            "title": self.title,
            "due_date": self.due_date,
            "priority": self.priority,
            "date_added": date_str,
            "done": self.done
        }

# Create database
with app.app_context():
    db.create_all()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/tasks', methods=['GET'])
def get_tasks():
    """
    Returns tasks sorted depending on query param:
    ?sort=added (default), ?sort=due, ?sort=priority
    Priority ordering: High -> Mid -> Low
    """
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
    else:  # default: sort by date_added (oldest first)
        tasks.sort(key=lambda t: t.date_added)

    return jsonify([task.to_dict() for task in tasks])

@app.route('/task/<int:id>', methods=['GET'])
def get_task(id):
    task = Task.query.get_or_404(id)
    return jsonify(task.to_dict())

@app.route('/add', methods=['POST'])
def add_task():
    data = request.json
    # combine date + time into single string (allow either or both)
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
        # if either provided, combine them (if empty strings included it's okay)
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

if __name__ == '__main__':
    app.run(debug=True)
