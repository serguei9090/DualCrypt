import os
import base64
import tkinter as tk
from tkinter import filedialog, messagebox
import ttkbootstrap as ttk
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

# Function to derive AES key from concatenated OTP codes
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

def decrypt_file(file_path, otp1_input, otp2_input):
    try:
        with open(file_path, 'rb') as f:
            encrypted_b64 = f.read()
        encrypted_data = base64.b64decode(encrypted_b64)
    except Exception as e:
        messagebox.showerror("Error", f"Failed to read encrypted file: {e}")
        return

    try:
        # Extract stored data: timestamp (8 bytes), salt (16 bytes), IV (16 bytes), ciphertext, and possibly an HMAC tag.
        encryption_time = int.from_bytes(encrypted_data[:8], 'big')
        salt = encrypted_data[8:24]
        iv = encrypted_data[24:40]
        # For example, if you appended a tag, assume last 16 bytes are tag.
        # If you are not using a tag, adjust accordingly.
        # Here we assume no tag (or you can use a tag as shown in the sample below).
        ciphertext = encrypted_data[40:]
        
        # Debug: Print the encryption timestamp
        print("Stored Encryption Timestamp:", encryption_time)
        
        # Use the provided 6-digit OTP codes directly (make sure they are exactly as generated during encryption)
        otp1_val = otp1_input.strip()
        otp2_val = otp2_input.strip()
        print("Provided OTP Code for Customer 1:", otp1_val)
        print("Provided OTP Code for Customer 2:", otp2_val)

        # Derive the key using the provided OTP codes and salt
        key = derive_key(otp1_val, otp2_val, salt)

        # If you have stored a verification tag (see below), verify it here.
        # Otherwise, proceed with decryption.
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        plaintext_padded = decryptor.update(ciphertext) + decryptor.finalize()

        # Remove PKCS#7 padding
        pad_len = plaintext_padded[-1]
        plaintext = plaintext_padded[:-pad_len]

        decrypted_file_path = file_path.replace(".enc", "_decrypt")
        with open(decrypted_file_path, 'wb') as f:
            f.write(plaintext)

        messagebox.showinfo("Success", f"File decrypted and saved as {decrypted_file_path}")

    except Exception as e:
        messagebox.showerror("Decryption Error", f"Failed to decrypt the file. Ensure OTP codes are correct.\nError: {e}")


# GUI Application with OTP code inputs masked and fixed width
def create_decrypt_gui():
    root = ttk.Window(themename="darkly")
    root.title("OTP-Based File Decryption")
    root.geometry("500x400")
    
    def select_file():
        file_path.set(filedialog.askopenfilename())
    
    ttk.Label(root, text="Select Encrypted File:").pack(pady=5)
    file_path = tk.StringVar()
    ttk.Entry(root, textvariable=file_path, width=50).pack(pady=5)
    ttk.Button(root, text="Browse", command=select_file).pack(pady=5)
    
    ttk.Label(root, text="Enter OTP Code for Customer 1:").pack(pady=5)
    otp1 = tk.StringVar()
    ttk.Entry(root, textvariable=otp1, width=8, show="*").pack(pady=5)
    
    ttk.Label(root, text="Enter OTP Code for Customer 2:").pack(pady=5)
    otp2 = tk.StringVar()
    ttk.Entry(root, textvariable=otp2, width=8, show="*").pack(pady=5)
    
    ttk.Button(root, text="Decrypt", command=lambda: decrypt_file(file_path.get(), otp1.get(), otp2.get())).pack(pady=10)
    
    root.mainloop()


if __name__ == "__main__":
    create_decrypt_gui()
