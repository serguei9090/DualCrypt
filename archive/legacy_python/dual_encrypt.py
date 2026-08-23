import os
import tkinter as tk
from tkinter import filedialog, messagebox
import ttkbootstrap as ttk
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import base64
import json
import random
import string

"""
Dual Password File Encryption Tool - Encryption Module

This script provides a GUI for encrypting files using two passwords. It utilizes AES-256 encryption
with PBKDF2 key derivation to enhance security. The GUI is built with ttkbootstrap for a modern look and feel.

Libraries Used:
- cryptography (Apache License 2.0) -> Provides AES encryption and PBKDF2 key derivation.
- ttkbootstrap (MIT License) -> Enhances Tkinter UI with modern styling.

License:
This script is released under the MIT License. Ensure compliance with the licenses of the included libraries.
"""

# Function to derive a cryptographic key from two passwords
def derive_key(password1, password2, salt):
    """Generates a 256-bit AES key using PBKDF2 with SHA-256."""
    combined_password = (password1 + password2).encode()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )
    return kdf.derive(combined_password)

# Function to generate a random strong password
def generate_password():
    """Generates a secure password with at least 3 uppercase letters, 3 lowercase letters, 3 digits, and 3 special characters."""
    upper = random.choices(string.ascii_uppercase, k=3)
    lower = random.choices(string.ascii_lowercase, k=3)
    digits = random.choices(string.digits, k=3)
    special = random.choices(string.punctuation, k=3)
    all_chars = upper + lower + digits + special
    random.shuffle(all_chars)
    return "".join(all_chars)

# Function to encrypt a file using AES-256
def encrypt_file(filepath, password1, password2):
    """Encrypts the selected file using AES-256 encryption and saves passwords to a text file."""
    salt = os.urandom(16)  # Generate a random salt
    key = derive_key(password1, password2, salt)  # Derive encryption key
    iv = os.urandom(16)  # Generate a random IV
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    
    with open(filepath, 'rb') as f:
        plaintext = f.read()
    
    # Padding for AES block size (16 bytes)
    pad_len = 16 - (len(plaintext) % 16)
    plaintext += bytes([pad_len]) * pad_len
    ciphertext = encryptor.update(plaintext) + encryptor.finalize()
    
    encrypted_data = {
        "salt": base64.b64encode(salt).decode(),
        "iv": base64.b64encode(iv).decode(),
        "ciphertext": base64.b64encode(ciphertext).decode()
    }
    
    enc_filepath = filepath + ".enc"
    with open(enc_filepath, "w") as f:
        json.dump(encrypted_data, f)
    
    password_filepath = filepath + "-password.txt"
    with open(password_filepath, "w") as f:
        f.write(f"Password 1: {password1}\nPassword 2: {password2}")
    
    messagebox.showinfo("Success", f"File encrypted successfully!\nSaved as: {enc_filepath}\nPasswords saved in: {password_filepath}")

# GUI Application for encryption
def create_encrypt_gui():
    """Creates and runs the Tkinter-based GUI for file encryption."""
    root = ttk.Window(themename="darkly")
    root.title("Dual Password File Encryption - Encrypt")
    root.geometry("500x300")
    root.columnconfigure(0, weight=1)
    root.columnconfigure(1, weight=1)
    root.rowconfigure(0, weight=1)
    
    def select_file():
        file_path.set(filedialog.askopenfilename())
    
    def encrypt():
        if not file_path.get() or not pass1.get() or not pass2.get():
            messagebox.showwarning("Warning", "Please provide all inputs.")
            return
        encrypt_file(file_path.get(), pass1.get(), pass2.get())
    
    def set_random_password1():
        pass1.set(generate_password())
    
    def set_random_password2():
        pass2.set(generate_password())
    
    frame = ttk.Frame(root)
    frame.pack(expand=True)
    
    ttk.Label(frame, text="Select File:").grid(row=0, column=0, pady=5, columnspan=2)
    file_path = tk.StringVar()
    ttk.Entry(frame, textvariable=file_path, width=50).grid(row=1, column=0, pady=5)
    ttk.Button(frame, text="Browse", command=select_file).grid(row=1, column=1, pady=5, padx=2)
    
    ttk.Label(frame, text="Password 1:").grid(row=2, column=0, pady=5)
    pass1 = tk.StringVar()
    pass1_entry = ttk.Entry(frame, textvariable=pass1, width=30)
    pass1_entry.grid(row=3, column=0, pady=5, sticky="ew")
    ttk.Button(frame, text="⟳", command=set_random_password1).grid(row=3, column=1, pady=5, padx=2, sticky="w")
    
    ttk.Label(frame, text="Password 2:").grid(row=4, column=0, pady=5)
    pass2 = tk.StringVar()
    pass2_entry = ttk.Entry(frame, textvariable=pass2, width=30)
    pass2_entry.grid(row=5, column=0, pady=5,sticky="ew")
    ttk.Button(frame, text="⟳", command=set_random_password2).grid(row=5, column=1, pady=5, padx=2,sticky="w")
    
    ttk.Button(frame, text="Encrypt", command=encrypt).grid(row=6, column=0, columnspan=1, pady=10)
    
    root.mainloop()

# Run the GUI application for encryption
if __name__ == "__main__":
    create_encrypt_gui()
