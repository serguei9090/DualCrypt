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

"""
Dual Password File Encryption Tool

This script provides a GUI for encrypting and decrypting files using two passwords. It utilizes AES-256 encryption
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

# Function to encrypt a file using AES-256
def encrypt_file(filepath, password1, password2):
    """Encrypts the selected file using AES-256 encryption."""
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
    
    messagebox.showinfo("Success", "File encrypted successfully! Saved as: " + enc_filepath)

# Function to decrypt an encrypted file
def decrypt_file(filepath, password1, password2):
    """Decrypts the selected file using AES-256 encryption."""
    with open(filepath, 'r') as f:
        encrypted_data = json.load(f)
    
    salt = base64.b64decode(encrypted_data['salt'])
    iv = base64.b64decode(encrypted_data['iv'])
    ciphertext = base64.b64decode(encrypted_data['ciphertext'])
    
    key = derive_key(password1, password2, salt)
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    
    plaintext = decryptor.update(ciphertext) + decryptor.finalize()
    
    # Remove padding
    pad_len = plaintext[-1]
    plaintext = plaintext[:-pad_len]
    
    dec_filepath = filepath.replace(".enc", "_decrypted")
    with open(dec_filepath, "wb") as f:
        f.write(plaintext)
    
    messagebox.showinfo("Success", "File decrypted successfully! Saved as: " + dec_filepath)

# GUI Application to provide a user-friendly interface
def create_gui():
    """Creates and runs the Tkinter-based GUI for file encryption and decryption."""
    root = ttk.Window(themename="darkly")
    root.title("Dual Password File Encryption")
    root.geometry("500x500")
    
    def select_file():
        file_path.set(filedialog.askopenfilename())
    
    def encrypt():
        if not file_path.get() or not pass1.get() or not pass2.get():
            messagebox.showwarning("Warning", "Please provide all inputs.")
            return
        encrypt_file(file_path.get(), pass1.get(), pass2.get())
    
    def decrypt():
        if not file_path.get() or not pass1.get() or not pass2.get():
            messagebox.showwarning("Warning", "Please provide all inputs.")
            return
        decrypt_file(file_path.get(), pass1.get(), pass2.get())
    
    ttk.Label(root, text="Select File:").pack(pady=5)
    file_path = tk.StringVar()
    ttk.Entry(root, textvariable=file_path, width=50).pack(pady=5)
    ttk.Button(root, text="Browse", command=select_file).pack(pady=5)
    
    ttk.Label(root, text="Password 1:").pack(pady=5)
    pass1 = tk.StringVar()
    ttk.Entry(root, textvariable=pass1, show="*", width=30).pack(pady=5)
    
    ttk.Label(root, text="Password 2:").pack(pady=5)
    pass2 = tk.StringVar()
    ttk.Entry(root, textvariable=pass2, show="*", width=30).pack(pady=5)
    
    ttk.Button(root, text="Encrypt", command=encrypt).pack(pady=10)
    ttk.Button(root, text="Decrypt", command=decrypt).pack(pady=10)
    
    root.mainloop()

# Run the GUI application
if __name__ == "__main__":
    create_gui()
