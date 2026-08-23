import os
import json
import pyotp
import qrcode
import tkinter as tk
from tkinter import filedialog, messagebox
import ttkbootstrap as ttk
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import base64
import time

# Default QR code save folder
DEFAULT_QR_FOLDER = os.path.join(os.getcwd(), "QRcode")
os.makedirs(DEFAULT_QR_FOLDER, exist_ok=True)

# Function to load or create OTP secrets
def load_or_create_secrets(filepath, customer):
    if not customer.strip():
        return None, None
    
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r') as f:
                secrets = json.load(f)
        except (json.JSONDecodeError, IOError):
            secrets = {}
    else:
        secrets = {}
    
    customer = customer.strip()
    if customer not in secrets:
        secrets[customer] = {
            "party1": pyotp.random_base32(),
            "party2": pyotp.random_base32(),
            "qr_confirmed": False
        }
        with open(filepath, 'w') as f:
            json.dump(secrets, f, indent=4)
    
    return secrets, secrets[customer]

# Function to load existing customers
def load_customers(filepath):
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r') as f:
                secrets = json.load(f)
            return [customer for customer, data in secrets.items()]
        except (json.JSONDecodeError, IOError):
            return []
    return []

# Function to generate QR codes
def generate_qr_codes(secrets, customer):
    customer = customer.strip()
    customer_qr_folder = os.path.join(DEFAULT_QR_FOLDER, customer)
    os.makedirs(customer_qr_folder, exist_ok=True)
    
    for party, secret in secrets[customer].items():
        if party not in ["qr_confirmed"]:
            qr_path = os.path.join(customer_qr_folder, f"{customer}_{party}_qr.png")
            otp_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=f"{customer}_{party}", issuer_name="Secure Encryption")
            qr = qrcode.make(otp_uri)
            qr.save(qr_path)
    
    secrets[customer]["qr_confirmed"] = True
    with open("otp_secrets.json", 'w') as f:
        json.dump(secrets, f, indent=4)

# Function to derive AES key from two OTPs
def derive_key(otp1, otp2, salt):
    """Generates a 256-bit AES key using PBKDF2 from two OTP values."""
    combined_otp = (otp1 + otp2).encode()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )
    return kdf.derive(combined_otp)

def encrypt_file(file_path, customer):
    """Encrypts a file using AES-256 with two OTPs derived from a fixed timestamp."""
    secrets, customer_secrets = load_or_create_secrets("otp_secrets.json", customer)

    # Use a fixed timestamp for OTP generation
    encryption_time = int(time.time())  # Store UNIX timestamp
    otp1 = pyotp.TOTP(customer_secrets["party1"]).at(encryption_time)
    otp2 = pyotp.TOTP(customer_secrets["party2"]).at(encryption_time)

    salt = os.urandom(16)
    key = derive_key(otp1, otp2, salt)

    with open(file_path, 'rb') as f:
        plaintext = f.read()

    iv = os.urandom(16)
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()

    pad_len = 16 - (len(plaintext) % 16)
    plaintext += bytes([pad_len] * pad_len)
    ciphertext = encryptor.update(plaintext) + encryptor.finalize()

    # Save timestamp + salt + IV + encrypted data in base64 format
    encrypted_data = base64.b64encode(encryption_time.to_bytes(8, 'big') + salt + iv + ciphertext).decode()

    encrypted_file_path = file_path + ".enc"
    with open(encrypted_file_path, 'w') as f:
        f.write(encrypted_data)
    print("Stored Encryption Timestamp:", encryption_time)
    print("Regenerated OTP1:", otp1)
    print("Regenerated OTP2:", otp2)
    messagebox.showinfo("Success", f"File encrypted and saved as {encrypted_file_path}")

# GUI Application
def create_encrypt_gui():
    root = ttk.Window(themename="darkly")
    root.title("OTP-Based File Encryption")
    root.geometry("500x550")
    
    def select_file():
        file_path.set(filedialog.askopenfilename())
    
    def update_qr_status(*args):
        selected_customer = customer_name.get().strip()
        customers = load_customers("otp_secrets.json")
        
        if selected_customer in customers:
            secrets, customer_secrets = load_or_create_secrets("otp_secrets.json", selected_customer)
            if customer_secrets.get("qr_confirmed", False):
                qr_status_label.config(text="QR Code ✅", foreground="green")
                qr_button.config(state=tk.DISABLED)
            else:
                qr_status_label.config(text="QR Code ❌", foreground="red")
                qr_button.config(state=tk.NORMAL)
        else:
            qr_status_label.config(text="QR Code ❌", foreground="red")
            qr_button.config(state=tk.NORMAL)
    
    ttk.Label(root, text="Customer Name:").pack(pady=5)
    customer_name = tk.StringVar()
    customer_name.trace_add("write", update_qr_status)
    
    customer_frame = ttk.Frame(root)
    customer_frame.pack(pady=5)
    
    customer_dropdown = ttk.Combobox(customer_frame, textvariable=customer_name, width=30)
    customer_dropdown.pack(side=tk.LEFT, padx=5)
    
    refresh_button = ttk.Button(customer_frame, text="Refresh", command=lambda: customer_dropdown.config(values=load_customers("otp_secrets.json")))
    refresh_button.pack(side=tk.LEFT)
    
    qr_status_label = ttk.Label(root, text="QR Code ❌", foreground="red")
    qr_status_label.pack(pady=5)
    
    qr_button = ttk.Button(root, text="Generate QR Code", command=lambda: [generate_qr_codes(load_or_create_secrets("otp_secrets.json", customer_name.get())[0], customer_name.get()), update_qr_status()])
    qr_button.pack(pady=10)
    
    ttk.Label(root, text="Select File to Encrypt:").pack(pady=5)
    file_path = tk.StringVar()
    ttk.Entry(root, textvariable=file_path, width=50).pack(pady=5)
    ttk.Button(root, text="Browse", command=select_file).pack(pady=5)
    
    ttk.Button(root, text="Encrypt", command=lambda: encrypt_file(file_path.get(), customer_name.get())).pack(pady=10)
    
    root.mainloop()

if __name__ == "__main__":
    create_encrypt_gui()
