from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
from datetime import datetime, timedelta
import secrets
import os
from functools import wraps


app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cybernet.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Email configuration (update with your email settings)
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your-email@gmail.com'
app.config['MAIL_PASSWORD'] = 'your-app-password'
app.config['MAIL_DEFAULT_SENDER'] = 'your-email@gmail.com'

db = SQLAlchemy(app)
mail = Mail(app)

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    last_login = db.Column(db.DateTime)

class PasswordReset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    token = db.Column(db.String(100), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)

# Helper Functions
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def validate_password(password):
    """Validate password strength"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Za-z]', password):
        return False, "Password must contain at least one letter"
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number"
    return True, "Password is valid"

def send_reset_email(user_email, reset_token):
    """Send password reset email"""
    try:
        msg = Message(
            'CyberNet - Password Reset Request',
            recipients=[user_email]
        )
        reset_url = url_for('reset_password_confirm', token=reset_token, _external=True)
        msg.html = f"""
        <div style="background: linear-gradient(135deg, #0c0c0c 0%, #1a0033 50%, #000000 100%); color: white; padding: 20px; font-family: Arial, sans-serif;">
            <h2 style="color: #00f5ff;">CyberNet Password Reset</h2>
            <p>You requested a password reset for your CyberNet account.</p>
            <p>Click the link below to reset your password:</p>
            <a href="{reset_url}" style="display: inline-block; background: linear-gradient(45deg, #00f5ff, #8a2be2); color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, please ignore this email.</p>
            <p style="color: #888;">- CyberNet Security Team</p>
        </div>
        """
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False

# Routes
@app.route('/')
def index():
    return render_template('base.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        confirm_password = data.get('confirm_password', '')
        
        # Validation
        errors = []
        
        if not username or len(username) < 3:
            errors.append('Username must be at least 3 characters long')
        
        if not email or '@' not in email:
            errors.append('Valid email address is required')
        
        if password != confirm_password:
            errors.append('Passwords do not match')
        
        valid_password, password_msg = validate_password(password)
        if not valid_password:
            errors.append(password_msg)
        
        # Check if user already exists
        if User.query.filter_by(username=username).first():
            errors.append('Username already exists')
        
        if User.query.filter_by(email=email).first():
            errors.append('Email already registered')
        
        if errors:
            if request.is_json:
                return jsonify({'success': False, 'errors': errors}), 400
            for error in errors:
                flash(error, 'error')
            return render_template('register.html')
        
        # Create new user
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password)
        )
        
        try:
            db.session.add(user)
            db.session.commit()
            
            # Auto login after registration
            session['user_id'] = user.id
            session['username'] = user.username
            
            if request.is_json:
                return jsonify({'success': True, 'message': 'Registration successful'})
            
            flash('Welcome to CyberNet! Registration successful.', 'success')
            return redirect(url_for('dashboard'))
            
        except Exception as e:
            db.session.rollback()
            if request.is_json:
                return jsonify({'success': False, 'errors': ['Registration failed. Please try again.']}), 500
            flash('Registration failed. Please try again.', 'error')
            return render_template('register.html')
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            if request.is_json:
                return jsonify({'success': False, 'error': 'Username and password are required'}), 400
            flash('Username and password are required', 'error')
            return render_template('login.html')
        
        # Try to find user by username or email
        user = User.query.filter(
            (User.username == username) | (User.email == username.lower())
        ).first()
        
        if user and check_password_hash(user.password_hash, password):
            if user.is_active:
                session['user_id'] = user.id
                session['username'] = user.username
                
                # Update last login
                user.last_login = datetime.utcnow()
                db.session.commit()
                
                if request.is_json:
                    return jsonify({'success': True, 'message': 'Login successful'})
                
                flash(f'Welcome back, {user.username}!', 'success')
                return redirect(url_for('dashboard'))
            else:
                if request.is_json:
                    return jsonify({'success': False, 'error': 'Account is deactivated'}), 400
                flash('Your account has been deactivated', 'error')
        else:
            if request.is_json:
                return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
            flash('Invalid username/email or password', 'error')
    
    return render_template('login.html')

@app.route('/dashboard')
@login_required
def dashboard():
    user = User.query.get(session['user_id'])
    return render_template('dashboard.html', user=user)

@app.route('/logout')
@login_required
def logout():
    username = session.get('username')
    session.clear()
    flash(f'Goodbye, {username}! You have been logged out.', 'info')
    return redirect(url_for('index'))

@app.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        email = data.get('email', '').strip().lower()
        
        if not email:
            if request.is_json:
                return jsonify({'success': False, 'error': 'Email address is required'}), 400
            flash('Email address is required', 'error')
            return render_template('reset_password.html')
        
        user = User.query.filter_by(email=email).first()
        
        if user:
            # Generate reset token
            token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(hours=1)
            
            # Create password reset record
            reset_request = PasswordReset(
                user_id=user.id,
                token=token,
                expires_at=expires_at
            )
            
            try:
                db.session.add(reset_request)
                db.session.commit()
                
                # Send email
                if send_reset_email(user.email, token):
                    if request.is_json:
                        return jsonify({'success': True, 'message': 'Reset link sent to your email'})
                    flash('Password reset link has been sent to your email', 'success')
                else:
                    if request.is_json:
                        return jsonify({'success': False, 'error': 'Failed to send email. Please try again.'}), 500
                    flash('Failed to send email. Please try again.', 'error')
                    
            except Exception as e:
                db.session.rollback()
                if request.is_json:
                    return jsonify({'success': False, 'error': 'Failed to process request'}), 500
                flash('Failed to process request. Please try again.', 'error')
        else:
            # Don't reveal if email exists or not for security
            if request.is_json:
                return jsonify({'success': True, 'message': 'If the email exists, a reset link has been sent'})
            flash('If the email exists in our system, a reset link has been sent', 'info')
    
    return render_template('reset_password.html')

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password_confirm(token):
    reset_request = PasswordReset.query.filter_by(token=token, used=False).first()
    
    if not reset_request or reset_request.expires_at < datetime.utcnow():
        flash('Invalid or expired reset link', 'error')
        return redirect(url_for('reset_password'))
    
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        password = data.get('password', '')
        confirm_password = data.get('confirm_password', '')
        
        if password != confirm_password:
            if request.is_json:
                return jsonify({'success': False, 'error': 'Passwords do not match'}), 400
            flash('Passwords do not match', 'error')
            return render_template('reset_password_confirm.html', token=token)
        
        valid_password, password_msg = validate_password(password)
        if not valid_password:
            if request.is_json:
                return jsonify({'success': False, 'error': password_msg}), 400
            flash(password_msg, 'error')
            return render_template('reset_password_confirm.html', token=token)
        
        try:
            # Update user password
            user = User.query.get(reset_request.user_id)
            user.password_hash = generate_password_hash(password)
            
            # Mark reset request as used
            reset_request.used = True
            
            db.session.commit()
            
            if request.is_json:
                return jsonify({'success': True, 'message': 'Password updated successfully'})
            
            flash('Password has been updated successfully. You can now log in.', 'success')
            return redirect(url_for('login'))
            
        except Exception as e:
            db.session.rollback()
            if request.is_json:
                return jsonify({'success': False, 'error': 'Failed to update password'}), 500
            flash('Failed to update password. Please try again.', 'error')
    
    return render_template('reset_password_confirm.html', token=token)

# API Routes for AJAX requests
@app.route('/api/user/profile')
@login_required
def api_user_profile():
    user = User.query.get(session['user_id'])
    return jsonify({
        'username': user.username,
        'email': user.email,
        'created_at': user.created_at.isoformat(),
        'last_login': user.last_login.isoformat() if user.last_login else None
    })

@app.route('/api/dashboard/stats')
@login_required
def api_dashboard_stats():
    # Mock dashboard statistics
    return jsonify({
        'neural_interface_status': 'Active',
        'security_level': 'Maximum',
        'network_connections': 42,
        'data_processed': '2.4 TB',
        'uptime': '99.9%',
        'active_sessions': 7
    })

# Error Handlers
@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(error):
    db.session.rollback()
    return render_template('500.html'), 500

# Database initialization
def create_tables():
    with app.app_context():
        db.create_all()

        # Create admin user if it doesn't exist
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin = User(
                username='admin',
                email='admin@cybernet.com',
                password_hash=generate_password_hash('CyberNet2024!')
            )
            db.session.add(admin)
            db.session.commit()
            print("Admin user created - Username: admin, Password: CyberNet2024!")

if __name__ == '__main__':
    create_tables()
    app.run(debug=True, host='0.0.0.0', port=5000)


    # Create database tables
    with app.app_context():
        db.create_all()
        
        # Create admin user if it doesn't exist
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin = User(
                username='admin',
                email='admin@cybernet.com',
                password_hash=generate_password_hash('CyberNet2024!')
            )
            db.session.add(admin)
            db.session.commit()
            print("Admin user created - Username: admin, Password: CyberNet2024!")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
