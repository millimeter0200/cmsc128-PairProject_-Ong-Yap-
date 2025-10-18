from flask import Flask, render_template, request, jsonify      # Flask: framework for python, josnify: translater between PY and JS --converts data (dicts/lists) into JSON(communicate back&front)
from flask_sqlalchemy import SQLAlchemy                         # SQLAlchemy: py lib helps talk to DB w/o queries (object rlational mapper-ORM)--treat DB tables like PY classes
from datetime import datetime                                   #Flas SQLAlchemy connects sqlA and Flask (create DB, manage DB sessions, linking flas to DB)

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///todo.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Task Model
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    due_date = db.Column(db.String(100), nullable=True)   # simple string first
    priority = db.Column(db.String(10), default="Mid")
    date_added = db.Column(db.DateTime, default=datetime.utcnow)
    done = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "due_date": self.due_date,
            "priority": self.priority,
            "date_added": self.date_added.strftime("%Y-%m-%d %H:%M"),
            "done": self.done
        }

# Create database
with app.app_context():
    db.create_all()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/task/<int:id>', methods=['GET'])
def get_task(id):
    task = Task.query.get_or_404(id)
    return jsonify(task.to_dict())

@app.route('/tasks', methods=['GET'])
def get_tasks():
    tasks = Task.query.all()
    return jsonify([task.to_dict() for task in tasks])

@app.route('/add', methods=['POST'])
def add_task():
    data = request.json
    new_task = Task(
        title=data['title'],
        due_date=data['due_date'],
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
    task.due_date = data.get('due_date', task.due_date)
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



    #front & backend communicate via JAVASCRIPT (sends Http with fetch ednpooints: accounts/login, accounts/register, accountforgot, acc/reset)-routes handled by flask backend
    #acc.html opens browser (visible elements), acc.js(reads user input, sends requests to backend using fetch, recieves backend response, updates the UI
    #app.py recievs http reuests from acc.js, talks to DB via SQLALch, makes/updates/query users, returns JSON responses with jsonify
    #session commit does the saving to DB so that changes persist allows multiple users to have accounts, implemented using Flask sessions  
    #session commit tracks changes made during session and saves to DB when commit is called