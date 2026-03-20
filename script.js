document.addEventListener('DOMContentLoaded', function() {
    // --- 1. ELEMENT SELECTION ---
    const form = document.getElementById('signupForm');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirm_password');
    const strengthBar = document.querySelector('.strength-bar');
    const modal = document.getElementById('successModal');
    const closeModal = document.querySelector('.close-modal');
    const colorOptions = document.querySelectorAll('.color-option');
    const favoriteColorInput = document.getElementById('favorite_color');
    const countrySelect = document.getElementById('country');

    // --- 2. INITIALIZATION ---
    loadAllCountries();

    // --- 3. EVENT LISTENERS ---

    // Initialize color picker
    colorOptions.forEach(option => {
        option.addEventListener('click', function() {
            const colorName = this.getAttribute('data-color');
            const bgStyle = window.getComputedStyle(this).backgroundColor;

            favoriteColorInput.value = colorName;
            favoriteColorInput.style.color = bgStyle;
            favoriteColorInput.style.borderColor = bgStyle;

            colorOptions.forEach(opt => {
                opt.style.transform = 'scale(1)';
                opt.style.boxShadow = '0 3px 6px rgba(0,0,0,0.1)';
                opt.style.border = '3px solid white';
            });
            this.style.transform = 'scale(1.3)';
            this.style.boxShadow = '0 0 15px rgba(0,0,0,0.3)';
            this.style.border = '3px solid #333';
        });
    });

    // Password strength listener
    password.addEventListener('input', function() {
        const strength = calculatePasswordStrength(this.value);
        updateStrengthBar(strength);
        validatePasswordMatch();
    });

    // Password match listener
    confirmPassword.addEventListener('input', validatePasswordMatch);

    // Close success modal listener
    closeModal.addEventListener('click', function() {
        modal.style.display = 'none';
        form.reset();
        resetPasswordStrength();
    });

    // Close success modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            form.reset();
            resetPasswordStrength();
        }
    });

    // Phone number formatting
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 3 && value.length <= 6) {
                value = '(' + value.slice(0, 3) + ') ' + value.slice(3);
            } else if (value.length > 6) {
                value = '(' + value.slice(0, 3) + ') ' + value.slice(3, 6) + '-' + value.slice(6, 10);
            }
            e.target.value = value;
        });
    }

    // Set max date for DOB
    const dobInput = document.getElementById('dob');
    if (dobInput) {
        const today = new Date().toISOString().split('T')[0];
        dobInput.max = today;
        dobInput.min = '1900-01-01';
        dobInput.addEventListener('change', function() {
            this.style.borderColor = '#4ecdc4';
        });
    }

    // Security question toggle
    const securityQuestion = document.getElementById('security_question');
    if (securityQuestion) {
        let customContainer = document.getElementById('custom_q_container');
        if (!customContainer) {
            customContainer = document.createElement('div');
            customContainer.id = 'custom_q_container';
            customContainer.className = 'form-group colorful-input';
            customContainer.innerHTML = `
                <label for="custom_security_question"><i class="fas fa-edit"></i> Custom Security Question</label>
                <input type="text" id="custom_security_question" name="custom_security_question" placeholder="Enter your custom question">
                <div class="input-decoration" style="background: #9b59b6;"></div>
            `;
            customContainer.style.display = 'none';
            securityQuestion.parentNode.parentNode.insertBefore(customContainer, securityQuestion.parentNode.parentNode.children[3]);
        }

        securityQuestion.addEventListener('change', function() {
            if (this.value === 'custom') {
                customContainer.style.display = 'block';
                const input = customContainer.querySelector('input');
                if (input) input.required = true;
            } else {
                customContainer.style.display = 'none';
                const input = customContainer.querySelector('input');
                if (input) {
                    input.required = false;
                    input.value = '';
                }
            }
        });
    }

    // --- POPUP STYLES (email/phone check modal) ---
    const precheckStyle = document.createElement('style');
    precheckStyle.textContent = `
        .precheck-overlay{
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.55);
            backdrop-filter: blur(6px);
            z-index: 2500;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
        }
        .precheck-card{
            width: 100%;
            max-width: 650px;
            background: white;
            border-radius: 18px;
            box-shadow: 0 18px 55px rgba(0,0,0,0.25);
            overflow: hidden;
            animation: precheckPop .18s ease;
        }
        @keyframes precheckPop { from { transform: scale(.98); opacity: .7; } to { transform: scale(1); opacity: 1; } }

        .precheck-top{
            display:flex;
            align-items:center;
            justify-content:space-between;
            padding: 16px 18px;
            background: linear-gradient(90deg, #ff6b6b, #4ecdc4, #54a0ff);
            color:white;
        }
        .precheck-top h3{ margin:0; font-size: 1.05rem; letter-spacing: .5px; }
        .precheck-x{
            border:none; background: rgba(255,255,255,0.2);
            color:white; width: 36px; height: 36px;
            border-radius: 10px; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
        }
        .precheck-body{
            padding: 18px;
        }
        .precheck-section{
            border: 1px solid #eee;
            border-radius: 14px;
            padding: 14px;
            margin-bottom: 12px;
        }
        .precheck-section-title{
            display:flex; align-items:center; gap:10px;
            font-weight: 800; color:#222; margin-bottom: 6px;
        }
        .precheck-section p{
            margin: 6px 0;
            color:#444;
            line-height: 1.45;
        }
        .precheck-bad{ color:#c0392b; font-weight:800; }
        .precheck-good{ color:#27ae60; font-weight:800; }
        .precheck-warn{ color:#f39c12; font-weight:800; }

        .precheck-actions{
            display:flex;
            gap: 12px;
            padding: 16px 18px;
            border-top: 1px solid #f0f0f0;
            background: #fafafa;
        }
        .precheck-btn{
            flex:1;
            border:none;
            border-radius: 14px;
            padding: 14px 16px;
            font-weight: 800;
            cursor: pointer;
        }
        .precheck-continue{
            background: linear-gradient(90deg, #1dd1a1, #54a0ff);
            color: white;
        }
        .precheck-change{
            background: #ffffff;
            border: 2px solid #ddd;
            color: #333;
        }
        .precheck-change:hover{ border-color:#bbb; }
    `;
    document.head.appendChild(precheckStyle);

    function focusField(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.focus({ preventScroll: false });
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.borderColor = '#ff6b6b';
        setTimeout(() => { el.style.borderColor = '#e0e0e0'; }, 1200);
    }

    function buildSectionHTML(label, info, extraLine) {
        const count = Number(info?.breach_count ?? 0);
        const list = info?.breaches ?? [];
        const error = info?.error ?? null;

        if (error) {
            return `
                <div class="precheck-section">
                    <div class="precheck-section-title">
                        <i class="fas fa-triangle-exclamation" style="color:#f39c12;"></i>
                        ${label}
                    </div>
                    <p class="precheck-warn">Can’t check right now</p>
                    <p>${escapeHtml(String(error))}</p>
                    ${extraLine ? `<p style="color:#666;font-size:.92rem;">${extraLine}</p>` : ``}
                </div>
            `;
        }

        if (count > 0) {
            const names = list.length ? list.map(escapeHtml).join(', ') : '(names unavailable)';
            return `
                <div class="precheck-section">
                    <div class="precheck-section-title">
                        <i class="fas fa-circle-exclamation" style="color:#ff6b6b;"></i>
                        ${label}
                    </div>
                    <p class="precheck-bad">Found in ${count} breach${count > 1 ? 'es' : ''}</p>
                    <p>Top results: <strong>${names}</strong></p>
                    ${extraLine ? `<p style="color:#666;font-size:.92rem;">${extraLine}</p>` : ``}
                </div>
            `;
        }

        return `
            <div class="precheck-section">
                <div class="precheck-section-title">
                    <i class="fas fa-circle-check" style="color:#27ae60;"></i>
                    ${label}
                </div>
                <p class="precheck-good">Not found in known breaches</p>
                ${extraLine ? `<p style="color:#666;font-size:.92rem;">${extraLine}</p>` : ``}
            </div>
        `;
    }

    function escapeHtml(str) {
        return String(str)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function showExposurePopup(emailInfo, phoneInfo, onContinue, onChange) {
        const emailProblem = !!emailInfo?.error || Number(emailInfo?.breach_count ?? 0) > 0;
        const phoneProblem = !!phoneInfo?.error || Number(phoneInfo?.breach_count ?? 0) > 0;

        let changeTarget = 'email';
        if (!emailProblem && phoneProblem) changeTarget = 'phone';

        const changeLabel = changeTarget === 'phone' ? 'Change phone' : 'Change email';

        const existing = document.getElementById('precheck-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'precheck-overlay';
        overlay.id = 'precheck-overlay';

        const normalizedPhone = phoneInfo?.normalized_phone ? `Normalized: ${escapeHtml(phoneInfo.normalized_phone)}` : null;

        overlay.innerHTML = `
            <div class="precheck-card" role="dialog" aria-modal="true">
                <div class="precheck-top">
                    <h3><i class="fas fa-shield-halved"></i> Contact exposure check</h3>
                    <button class="precheck-x" id="precheck-x" aria-label="Close">
                        <i class="fas fa-xmark"></i>
                    </button>
                </div>

                <div class="precheck-body">
                    ${buildSectionHTML('Email', emailInfo, 'You can continue, but consider changing passwords on affected services.')}
                    ${buildSectionHTML('Phone', phoneInfo, normalizedPhone || 'Phone searches work best with country code (international format).')}
                </div>

                <div class="precheck-actions">
                    <button class="precheck-btn precheck-change" id="precheck-change">
                        <i class="fas fa-pen-to-square"></i> ${changeLabel}
                    </button>
                    <button class="precheck-btn precheck-continue" id="precheck-continue">
                        <i class="fas fa-check"></i> Continue
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const cleanup = () => {
            const el = document.getElementById('precheck-overlay');
            if (el) el.remove();
        };

        const doChange = () => {
            cleanup();
            if (changeTarget === 'phone') focusField('phone');
            else focusField('email');
            if (typeof onChange === 'function') onChange(changeTarget);
        };

        document.getElementById('precheck-continue').addEventListener('click', () => {
            cleanup();
            if (typeof onContinue === 'function') onContinue();
        });

        document.getElementById('precheck-change').addEventListener('click', doChange);
        document.getElementById('precheck-x').addEventListener('click', doChange);
    }

    // --- 4. FORM SUBMISSION ---
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (validateForm()) {
            const submitBtn = form.querySelector('.rainbow-button');
            const originalBtnContent = submitBtn.innerHTML;

            submitBtn.innerHTML = '<span class="button-text"><i class="fas fa-circle-notch fa-spin"></i> ANALYZING SECURITY...</span>';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('http://127.0.0.1:5000/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    showExposurePopup(
                        result.email_breach_info,
                        result.phone_breach_info,
                        () => {
                            modal.style.display = 'flex';
                            createConfetti();
                        },
                        () => {}
                    );
                } else {
                    // ✅ show AI suggestions (if backend returns them)
                    showError(password, result.error || 'Signup failed', result.suggestions || []);

                    const pwGroup = password.closest('.form-group');
                    pwGroup.classList.add('shake');
                    setTimeout(() => pwGroup.classList.remove('shake'), 500);
                }

            } catch (error) {
                console.error('Error:', error);
                alert("Could not connect to the Backend. Make sure 'python3 app.py' is running!");
            } finally {
                submitBtn.innerHTML = originalBtnContent;
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
        }
    });

    // --- 5. HELPER FUNCTIONS ---

    function loadAllCountries() {
        const countries = [
            "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria",
            "Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan",
            "Bolivia","Bosnia","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia",
            "Cameroon","Canada","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica",
            "Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Ecuador","Egypt",
            "El Salvador","Estonia","Ethiopia","Fiji","Finland","France","Gabon",
            "Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guyana",
            "Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel",
            "Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kuwait","Laos","Latvia","Lebanon",
            "Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives",
            "Mali","Malta","Mexico","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia",
            "Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Macedonia","Norway","Oman",
            "Pakistan","Palestine","Panama","Paraguay","Peru","Philippines","Poland","Portugal",
            "Qatar","Romania","Russia","Rwanda","Saudi Arabia","Senegal","Serbia","Singapore","Slovakia","Slovenia",
            "Somalia","South Africa","South Sudan","Spain","Sri Lanka","Sudan","Sweden","Switzerland","Syria","Taiwan",
            "Tajikistan","Tanzania","Thailand","Togo","Tunisia","Turkey","Turkmenistan",
            "Uganda","Ukraine","UAE","United Kingdom","United States","Uruguay","Uzbekistan","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
        ];

        countries.sort();
        countrySelect.innerHTML = '<option value="">Select Country</option>';
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        });
    }

    function calculatePasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (password.length >= 12) strength += 10;
        if (/[a-z]/.test(password)) strength += 15;
        if (/[A-Z]/.test(password)) strength += 15;
        if (/[0-9]/.test(password)) strength += 15;
        if (/[^A-Za-z0-9]/.test(password)) strength += 20;
        return Math.min(strength, 100);
    }

    function updateStrengthBar(strength) {
        strengthBar.style.width = strength + '%';
        if (strength < 40) {
            strengthBar.style.backgroundColor = '#ff6b6b';
        } else if (strength < 70) {
            strengthBar.style.backgroundColor = '#feca57';
        } else {
            strengthBar.style.backgroundColor = '#1dd1a1';
        }
    }

    function resetPasswordStrength() {
        strengthBar.style.width = '0%';
        strengthBar.style.backgroundColor = '#ff6b6b';
    }

    function validatePasswordMatch() {
        if (password.value !== confirmPassword.value && confirmPassword.value !== '') {
            showError(confirmPassword, 'Passwords do not match');
            return false;
        } else {
            hideError(confirmPassword);
            return true;
        }
    }

    function validateForm() {
        let isValid = true;
        clearErrors();

        const requiredFields = form.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            if (field.offsetParent === null) return;
            if (!field.value.trim()) {
                showError(field, 'This field is required');
                isValid = false;
            }
        });

        const email = document.getElementById('email');
        if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
            showError(email, 'Please enter a valid email');
            isValid = false;
        }

        return isValid;
    }

    // ✅ UPDATED: showError supports suggestions inside red error box
    function showError(field, message, suggestions = []) {
        let parent = field.closest('.colorful-input') || field.parentElement;
        let errorElement = parent.querySelector('.error-message');

        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            parent.appendChild(errorElement);
        }

        let html = `<div class="err-main">${escapeHtml(message)}</div>`;

        if (Array.isArray(suggestions) && suggestions.length > 0) {
            const items = suggestions.map(s => `
                <button type="button" class="pw-suggestion" data-pw="${escapeHtml(s)}">${escapeHtml(s)}</button>
            `).join("");

            html += `
                <div class="pw-suggest-title">Try one of these (click to copy + fill password):</div>
                <div class="pw-suggest-wrap">${items}</div>
                <div class="pw-suggest-hint">Paste it into Confirm Password + save it in a text file.</div>
                <div class="pw-suggest-toast" style="display:none;"></div>
            `;
        }

        errorElement.innerHTML = html;
        errorElement.style.display = 'block';
        field.style.borderColor = '#ff6b6b';

        // Wire suggestion buttons
        const btns = errorElement.querySelectorAll('.pw-suggestion');
        btns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const pw = btn.getAttribute('data-pw') || '';

                // Fill ONLY main password field
                const pwField = document.getElementById('password');
                if (pwField) pwField.value = pw;

                // update strength bar
                const strength = calculatePasswordStrength(pw);
                updateStrengthBar(strength);

                // copy to clipboard (fallback included)
                const copied = await copyToClipboard(pw);

                const toast = errorElement.querySelector('.pw-suggest-toast');
                if (toast) {
                    toast.textContent = copied ? "Copied ✅" : "Couldn’t auto-copy — copy manually.";
                    toast.style.display = 'block';
                    setTimeout(() => { toast.style.display = 'none'; }, 1600);
                }
            });
        });
    }

    function hideError(field) {
        let parent = field.closest('.colorful-input') || field.parentElement;
        const errorElement = parent.querySelector('.error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        field.style.borderColor = '#2ecc71';
    }

    function clearErrors() {
        document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');
        document.querySelectorAll('input, select').forEach(input => input.style.borderColor = '#e0e0e0');
    }

    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (e) {}

        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (e) {
            return false;
        }
    }

    // Styles (shake + suggestion buttons)
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        .shake { animation: shake 0.5s; }

        .error-message { color: #ff6b6b; font-size: 0.85rem; margin-top: 5px; display:none; }

        .pw-suggest-title{
            margin-top: 10px;
            font-weight: 800;
            color: #333;
            font-size: 0.9rem;
        }
        .pw-suggest-wrap{
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
        }
        .pw-suggestion{
            border: 1px solid #ffd6d6;
            background: #fff5f5;
            color: #b03030;
            font-weight: 900;
            padding: 8px 10px;
            border-radius: 12px;
            cursor: pointer;
            text-align: left;
        }
        .pw-suggestion:hover{
            filter: brightness(0.98);
        }
        .pw-suggest-hint{
            margin-top: 8px;
            color: #666;
            font-size: 0.85rem;
        }
        .pw-suggest-toast{
            margin-top: 8px;
            font-size: 0.85rem;
            font-weight: 900;
            color: #2ecc71;
        }
    `;
    document.head.appendChild(style);

    function createConfetti() {
        const colors = ['#ff6b6b', '#4ecdc4', '#54a0ff', '#feca57', '#ff9ff3', '#1dd1a1'];
        for (let i = 0; i < 30; i++) {
            const confetti = document.createElement('div');
            confetti.innerHTML = '🎉';
            confetti.style.cssText = `
                position: fixed;
                font-size: 20px;
                color: ${colors[Math.floor(Math.random() * colors.length)]};
                z-index: 2000;
                left: ${Math.random() * 100}%;
                top: -30px;
                animation: confettiFall ${Math.random() * 3 + 2}s linear forwards;
            `;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 5000);
        }
    }

    const confettiStyle = document.createElement('style');
    confettiStyle.textContent = `
        @keyframes confettiFall {
            0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
    `;
    document.head.appendChild(confettiStyle);
});

