import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from jinja2 import Template
import os

# SMTP podešavanja (za Gmail)
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "tvojemail@gmail.com"  # Zameni sa tvojim Gmail-om
SENDER_PASSWORD = "tvoja lozinka ili app password"  # Zameni

def send_email(to_email: str, subject: str, html_content: str):
    """Šalje email sa HTML sadržajem"""
    try:
        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = to_email
        msg["Subject"] = subject
        
        msg.attach(MIMEText(html_content, "html"))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"✅ Email poslat na {to_email}")
        return True
    except Exception as e:
        print(f"❌ Greška pri slanju email-a: {e}")
        return False


def send_welcome_email(to_email: str, full_name: str):
    """Šalje dobrodošlicu nakon registracije"""
    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; }}
            .footer {{ background: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>🚚 CargoApp</h2>
            </div>
            <div class="content">
                <h3>Dobrodošli, {full_name}!</h3>
                <p>Uspešno ste se registrovali na CargoApp platformu.</p>
                <p>Sada možete:</p>
                <ul>
                    <li>📦 Kreirati pošiljke</li>
                    <li>📍 Pratiti svoje pošiljke u realnom vremenu</li>
                    <li>💬 Komunicirati sa vozačima</li>
                </ul>
                <p>Hvala što koristite našu uslugu!</p>
            </div>
            <div class="footer">
                <p>CargoApp - Brza i pouzdana dostava</p>
            </div>
        </div>
    </body>
    </html>
    """
    return send_email(to_email, "Dobrodošli u CargoApp", html)


def send_shipment_status_email(to_email: str, shipment_id: int, status: str, details: dict = None):
    """Šalje email o statusu pošiljke"""
    
    status_texts = {
        "created": "📦 Pošiljka kreirana",
        "accepted": "✅ Pošiljka prihvaćena",
        "picked_up": "📦 Pošiljka preuzeta",
        "in_transit": "🚚 Pošiljka u transportu",
        "delivered": "🏁 Pošiljka dostavljena"
    }
    
    status_colors = {
        "created": "#667eea",
        "accepted": "#17a2b8",
        "picked_up": "#4caf50",
        "in_transit": "#ff9800",
        "delivered": "#28a745"
    }
    
    title = status_texts.get(status, "Status pošiljke ažuriran")
    color = status_colors.get(status, "#667eea")
    
    details_html = ""
    if details:
        details_html = "<table style='width: 100%; border-collapse: collapse; margin-top: 15px;'>"
        for key, value in details.items():
            details_html += f"""
            <tr>
                <td style='padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;'>{key}:</td>
                <td style='padding: 8px; border-bottom: 1px solid #eee;'>{value}</td>
            </tr>
            """
        details_html += "</table>"
    
    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: {color}; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; }}
            .footer {{ background: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>🚚 CargoApp</h2>
                <h3>{title}</h3>
            </div>
            <div class="content">
                <p>Poštovani,</p>
                <p>Status vaše pošiljke <strong>#{shipment_id}</strong> je promenjen.</p>
                {details_html}
                <p style="margin-top: 20px;">
                    <a href="http://localhost:5173/dashboard" style="background: {color}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                        Pogledaj detalje
                    </a>
                </p>
            </div>
            <div class="footer">
                <p>CargoApp - Brza i pouzdana dostava</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, title, html)


def send_delivery_receipt_email(to_email: str, shipment, signature_base64: str = None):
    """Šalje potvrdu o dostavi i račun"""
    
    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #28a745; color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; }}
            .invoice {{ background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 15px 0; }}
            .footer {{ background: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>🚚 CargoApp</h2>
                <h3>📦 Potvrda o dostavi</h3>
            </div>
            <div class="content">
                <p>Poštovani,</p>
                <p>Vaša pošiljka <strong>#{shipment.id}</strong> je uspešno dostavljena.</p>
                
                <div class="invoice">
                    <h3>📄 RAČUN</h3>
                    <table style="width: 100%;">
                        <tr><td><strong>Broj pošiljke:</strong></td><td>#{shipment.id}</td></tr>
                        <tr><td><strong>Datum dostave:</strong></td><td>{shipment.delivered_at.strftime('%d.%m.%Y %H:%M') if shipment.delivered_at else 'N/A'}</td></tr>
                        <tr><td><strong>Od:</strong></td><td>{shipment.pickup_address}</td></tr>
                        <tr><td><strong>Do:</strong></td><td>{shipment.delivery_address}</td></tr>
                        <tr><td><strong>Opis:</strong></td><td>{shipment.cargo_description}</td></tr>
                        <tr><td><strong>Težina:</strong></td><td>{shipment.weight_kg or 'N/A'} kg</td></tr>
                        <tr><td><strong>Cena:</strong></td><td><strong>{shipment.price} RSD</strong></td></tr>
                    </table>
                </div>
                
                <p>Hvala što koristite CargoApp!</p>
            </div>
            <div class="footer">
                <p>CargoApp - Brza i pouzdana dostava</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, f"📦 Potvrda o dostavi #{shipment.id}", html)