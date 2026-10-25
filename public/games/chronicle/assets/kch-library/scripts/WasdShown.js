(function() {
    'use strict';

    window.addEventListener('load', () => {
        // Default settings
        const defaultSettings = {
            keybindColors: {
                W: 'rgba(0, 0, 0, 0.3)',
                A: 'rgba(0, 0, 0, 0.3)',
                S: 'rgba(0, 0, 0, 0.3)',
                D: 'rgba(0, 0, 0, 0.3)',
                Shift: 'rgba(0, 0, 0, 0.3)',
                LeftMouse: 'rgba(0, 0, 0, 0.3)',
                RightMouse: 'rgba(0, 0, 0, 0.3)',
            },
            keybindButtonSize: '40',
            keybindButtonOpacity: '1',
            keybindPressedColor: 'rgba(0, 255, 0, 0.7)',
            keybindFontSize: '14',
            keybindBorderThickness: '2',
            keybindDarkMode: 'false',
            keybindButtonShape: 'circle',
            keybindTheme: 'light',
            keybindMenuBackground: 'transparent',
            keybindMenuBlur: 'false',
            keybindMenuOpaque: 'false',
            keybindButtonsVisible: 'true',
            keybindButtonOutline: 'true',
            keybindButtonPositionX: '20', // Horizontal position
            keybindButtonPositionY: '50', // Vertical position
        };

        // Load saved settings or use defaults
        const savedColors = JSON.parse(localStorage.getItem('keybindColors')) || defaultSettings.keybindColors;
        const savedButtonSize = localStorage.getItem('keybindButtonSize') || defaultSettings.keybindButtonSize;
        const savedButtonOpacity = localStorage.getItem('keybindButtonOpacity') || defaultSettings.keybindButtonOpacity;
        const savedPressedColor = localStorage.getItem('keybindPressedColor') || defaultSettings.keybindPressedColor;
        const savedFontSize = localStorage.getItem('keybindFontSize') || defaultSettings.keybindFontSize;
        const savedBorderThickness = localStorage.getItem('keybindBorderThickness') || defaultSettings.keybindBorderThickness;
        const savedDarkMode = localStorage.getItem('keybindDarkMode') || defaultSettings.keybindDarkMode;
        const savedButtonShape = localStorage.getItem('keybindButtonShape') || defaultSettings.keybindButtonShape;
        const savedTheme = localStorage.getItem('keybindTheme') || defaultSettings.keybindTheme;
        const savedMenuBackground = localStorage.getItem('keybindMenuBackground') || defaultSettings.keybindMenuBackground;
        const savedMenuBlur = localStorage.getItem('keybindMenuBlur') || defaultSettings.keybindMenuBlur;
        const savedMenuOpaque = localStorage.getItem('keybindMenuOpaque') || defaultSettings.keybindMenuOpaque;
        const savedButtonsVisible = localStorage.getItem('keybindButtonsVisible') || defaultSettings.keybindButtonsVisible;
        const savedButtonOutline = localStorage.getItem('keybindButtonOutline') || defaultSettings.keybindButtonOutline;
        const savedButtonPositionX = localStorage.getItem('keybindButtonPositionX') || defaultSettings.keybindButtonPositionX;
        const savedButtonPositionY = localStorage.getItem('keybindButtonPositionY') || defaultSettings.keybindButtonPositionY;

        const keys = [
            { id: 'W', label: 'W', keyCode: 'KeyW' },
            { id: 'A', label: 'A', keyCode: 'KeyA' },
            { id: 'S', label: 'S', keyCode: 'KeyS' },
            { id: 'D', label: 'D', keyCode: 'KeyD' },
            { id: 'Shift', label: 'Shift', keyCode: 'ShiftLeft' },
            { id: 'LeftMouse', label: 'LMB', keyCode: 'Mouse0' },
            { id: 'RightMouse', label: 'RMB', keyCode: 'Mouse2' },
        ];

        let pressedColor = savedPressedColor;
        let fontSize = parseInt(savedFontSize, 10);
        let borderThickness = parseInt(savedBorderThickness, 10);
        let buttonSize = parseInt(savedButtonSize, 10);
        let buttonOpacity = parseFloat(savedButtonOpacity);
        let buttonShape = savedButtonShape;
        let isDarkMode = savedDarkMode === 'true';
        let currentTheme = savedTheme;
        let menuBackground = savedMenuBackground;
        let menuBlur = savedMenuBlur === 'true';
        let menuOpaque = savedMenuOpaque === 'true';
        let buttonsVisible = savedButtonsVisible === 'true';
        let buttonOutline = savedButtonOutline === 'true';
        let buttonPositionX = parseInt(savedButtonPositionX, 10); // Horizontal position
        let buttonPositionY = parseInt(savedButtonPositionY, 10); // Vertical position

        let buttonColors = { ...savedColors };

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = `${buttonPositionX}px`; // Set initial horizontal position
        container.style.top = `${buttonPositionY}%`; // Set initial vertical position
        container.style.transform = 'translateY(-50%)';
        container.style.display = buttonsVisible ? 'flex' : 'none';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.zIndex = '9999';
        container.style.opacity = buttonOpacity;

        const buttonElements = {};

        function createButton(key) {
            const button = document.createElement('div');
            button.id = key.id;
            button.style.width = `${buttonSize}px`;
            button.style.height = `${buttonSize}px`;
            button.style.borderRadius = buttonShape === 'circle' ? '50%' : '0';
            button.style.margin = '5px';
            button.style.backgroundColor = buttonColors[key.id];
            button.style.border = buttonOutline ? `${borderThickness}px solid ${isDarkMode ? 'black' : 'white'}` : 'none';
            button.style.display = 'flex';
            button.style.justifyContent = 'center';
            button.style.alignItems = 'center';
            button.style.color = 'white';
            button.style.fontSize = `${fontSize}px`;
            button.style.fontWeight = 'bold';
            button.innerText = key.label;
            button.style.transition = 'background-color 0.2s ease';
            buttonElements[key.id] = button;
            return button;
        }

        keys.forEach(key => {
            const button = createButton(key);
            container.appendChild(button);
        });
        document.body.appendChild(container);

        // Event listeners for key and mouse presses
        document.addEventListener('keydown', (event) => {
            const key = keys.find(k => k.keyCode === event.code);
            if (key) {
                const button = buttonElements[key.id];
                button.style.backgroundColor = pressedColor;
            }
        });

        document.addEventListener('keyup', (event) => {
            const key = keys.find(k => k.keyCode === event.code);
            if (key) {
                const button = buttonElements[key.id];
                button.style.backgroundColor = buttonColors[key.id];
            }
        });

        document.addEventListener('mousedown', (event) => {
            if (event.button === 0) { // Left mouse button
                const button = buttonElements['LeftMouse'];
                button.style.backgroundColor = pressedColor;
            } else if (event.button === 2) { // Right mouse button
                const button = buttonElements['RightMouse'];
                button.style.backgroundColor = pressedColor;
            }
        });

        document.addEventListener('mouseup', (event) => {
            if (event.button === 0) { // Left mouse button
                const button = buttonElements['LeftMouse'];
                button.style.backgroundColor = buttonColors['LeftMouse'];
            } else if (event.button === 2) { // Right mouse button
                const button = buttonElements['RightMouse'];
                button.style.backgroundColor = buttonColors['RightMouse'];
            }
        });

        // Settings menu creation
        let colorMenuVisible = false;
        const menu = document.createElement('div');
        menu.style.position = 'fixed';
        menu.style.top = '50%';
        menu.style.left = '50%';
        menu.style.transform = 'translate(-50%, -50%)';
        menu.style.display = 'grid';
        menu.style.gridTemplateColumns = 'repeat(3, 1fr)';
        menu.style.gap = '10px';
        menu.style.backgroundColor = menuOpaque ? (isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)') : menuBackground;
        menu.style.color = isDarkMode ? 'white' : 'black';
        menu.style.padding = '20px';
        menu.style.width = '600px';
        menu.style.borderRadius = '10px';
        menu.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.2)';
        menu.style.zIndex = '10000';
        menu.style.display = 'none';
        menu.style.opacity = '0';
        menu.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        menu.style.backdropFilter = menuBlur ? 'blur(10px)' : 'none';

        // Color inputs
        keys.forEach(key => {
            const colorInputContainer = document.createElement('div');
            colorInputContainer.style.display = 'flex';
            colorInputContainer.style.flexDirection = 'column';
            colorInputContainer.style.alignItems = 'center';

            const label = document.createElement('label');
            label.innerText = `${key.label} Color: `;
            label.style.marginBottom = '5px';

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = buttonColors[key.id];
            colorInput.style.marginBottom = '10px';

            colorInput.addEventListener('input', function() {
                buttonColors[key.id] = colorInput.value;
                const button = document.getElementById(key.id);
                button.style.backgroundColor = colorInput.value;
                localStorage.setItem('keybindColors', JSON.stringify(buttonColors));
            });

            colorInputContainer.appendChild(label);
            colorInputContainer.appendChild(colorInput);
            menu.appendChild(colorInputContainer);
        });

        // Pressed color picker
        const pressedColorContainer = document.createElement('div');
        pressedColorContainer.style.display = 'flex';
        pressedColorContainer.style.flexDirection = 'column';
        pressedColorContainer.style.alignItems = 'center';

        const pressedColorLabel = document.createElement('label');
        pressedColorLabel.innerText = 'Pressed Color: ';
        pressedColorLabel.style.marginBottom = '5px';

        const pressedColorInput = document.createElement('input');
        pressedColorInput.type = 'color';
        pressedColorInput.value = pressedColor;
        pressedColorInput.style.marginBottom = '10px';

        pressedColorInput.addEventListener('input', function() {
            pressedColor = pressedColorInput.value;
            localStorage.setItem('keybindPressedColor', pressedColor);
        });

        pressedColorContainer.appendChild(pressedColorLabel);
        pressedColorContainer.appendChild(pressedColorInput);
        menu.appendChild(pressedColorContainer);

        // Button size slider
        const sizeContainer = document.createElement('div');
        sizeContainer.style.display = 'flex';
        sizeContainer.style.flexDirection = 'column';
        sizeContainer.style.alignItems = 'center';

        const sizeLabel = document.createElement('label');
        sizeLabel.innerText = 'Button Size: ';
        sizeLabel.style.marginBottom = '5px';

        const sizeSlider = document.createElement('input');
        sizeSlider.type = 'range';
        sizeSlider.min = '20';
        sizeSlider.max = '100';
        sizeSlider.value = buttonSize;
        sizeSlider.addEventListener('input', function() {
            buttonSize = parseInt(sizeSlider.value, 10);
            updateButtonSize(buttonSize);
        });

        sizeContainer.appendChild(sizeLabel);
        sizeContainer.appendChild(sizeSlider);
        menu.appendChild(sizeContainer);

        // Button opacity slider
        const opacityContainer = document.createElement('div');
        opacityContainer.style.display = 'flex';
        opacityContainer.style.flexDirection = 'column';
        opacityContainer.style.alignItems = 'center';

        const opacityLabel = document.createElement('label');
        opacityLabel.innerText = 'Button Opacity: ';
        opacityLabel.style.marginBottom = '5px';

        const opacitySlider = document.createElement('input');
        opacitySlider.type = 'range';
        opacitySlider.min = '0.1';
        opacitySlider.max = '1';
        opacitySlider.step = '0.1';
        opacitySlider.value = buttonOpacity;
        opacitySlider.addEventListener('input', function() {
            buttonOpacity = parseFloat(opacitySlider.value);
            updateButtonOpacity(buttonOpacity);
        });

        opacityContainer.appendChild(opacityLabel);
        opacityContainer.appendChild(opacitySlider);
        menu.appendChild(opacityContainer);

        // Button shape toggle
        const shapeContainer = document.createElement('div');
        shapeContainer.style.display = 'flex';
        shapeContainer.style.flexDirection = 'column';
        shapeContainer.style.alignItems = 'center';

        const shapeLabel = document.createElement('label');
        shapeLabel.innerText = 'Button Shape: ';
        shapeLabel.style.marginBottom = '5px';

        const shapeToggle = document.createElement('button');
        shapeToggle.innerText = buttonShape === 'circle' ? 'Switch to Square' : 'Switch to Circle';
        shapeToggle.addEventListener('click', () => {
            buttonShape = buttonShape === 'circle' ? 'square' : 'circle';
            shapeToggle.innerText = buttonShape === 'circle' ? 'Switch to Square' : 'Switch to Circle';
            updateButtonShape(buttonShape);
        });

        shapeContainer.appendChild(shapeLabel);
        shapeContainer.appendChild(shapeToggle);
        menu.appendChild(shapeContainer);

        // Theme dropdown
        const themeContainer = document.createElement('div');
        themeContainer.style.display = 'flex';
        themeContainer.style.flexDirection = 'column';
        themeContainer.style.alignItems = 'center';

        const themeLabel = document.createElement('label');
        themeLabel.innerText = 'Theme: ';
        themeLabel.style.marginBottom = '5px';

        const themeDropdown = document.createElement('select');
        themeDropdown.innerHTML = `
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="custom">Custom</option>
        `;
        themeDropdown.value = currentTheme;
        themeDropdown.addEventListener('change', () => {
            currentTheme = themeDropdown.value;
            applyTheme(currentTheme);
        });

        themeContainer.appendChild(themeLabel);
        themeContainer.appendChild(themeDropdown);
        menu.appendChild(themeContainer);

        // Menu background style dropdown
        const menuBackgroundContainer = document.createElement('div');
        menuBackgroundContainer.style.display = 'flex';
        menuBackgroundContainer.style.flexDirection = 'column';
        menuBackgroundContainer.style.alignItems = 'center';

        const menuBackgroundLabel = document.createElement('label');
        menuBackgroundLabel.innerText = 'Menu Background: ';
        menuBackgroundLabel.style.marginBottom = '5px';

        const menuBackgroundDropdown = document.createElement('select');
        menuBackgroundDropdown.innerHTML = `
            <option value="transparent">Transparent</option>
            <option value="opaque">Opaque</option>
        `;
        menuBackgroundDropdown.value = menuBackground;
        menuBackgroundDropdown.addEventListener('change', () => {
            menuBackground = menuBackgroundDropdown.value;
            updateMenuBackground(menuBackground);
        });

        menuBackgroundContainer.appendChild(menuBackgroundLabel);
        menuBackgroundContainer.appendChild(menuBackgroundDropdown);
        menu.appendChild(menuBackgroundContainer);

        // Menu blur toggle
        const menuBlurContainer = document.createElement('div');
        menuBlurContainer.style.display = 'flex';
        menuBlurContainer.style.flexDirection = 'column';
        menuBlurContainer.style.alignItems = 'center';

        const menuBlurLabel = document.createElement('label');
        menuBlurLabel.innerText = 'Menu Blur: ';
        menuBlurLabel.style.marginBottom = '5px';

        const menuBlurToggle = document.createElement('button');
        menuBlurToggle.innerText = menuBlur ? 'Disable Blur' : 'Enable Blur';
        menuBlurToggle.addEventListener('click', () => {
            menuBlur = !menuBlur;
            menuBlurToggle.innerText = menuBlur ? 'Disable Blur' : 'Enable Blur';
            updateMenuBlur(menuBlur);
        });

        menuBlurContainer.appendChild(menuBlurLabel);
        menuBlurContainer.appendChild(menuBlurToggle);
        menu.appendChild(menuBlurContainer);

        // Menu opaque toggle
        const menuOpaqueContainer = document.createElement('div');
        menuOpaqueContainer.style.display = 'flex';
        menuOpaqueContainer.style.flexDirection = 'column';
        menuOpaqueContainer.style.alignItems = 'center';

        const menuOpaqueLabel = document.createElement('label');
        menuOpaqueLabel.innerText = 'Menu Opaque: ';
        menuOpaqueLabel.style.marginBottom = '5px';

        const menuOpaqueToggle = document.createElement('button');
        menuOpaqueToggle.innerText = menuOpaque ? 'Disable Opaque' : 'Enable Opaque';
        menuOpaqueToggle.addEventListener('click', () => {
            menuOpaque = !menuOpaque;
            menuOpaqueToggle.innerText = menuOpaque ? 'Disable Opaque' : 'Enable Opaque';
            updateMenuOpaque(menuOpaque);
        });

        menuOpaqueContainer.appendChild(menuOpaqueLabel);
        menuOpaqueContainer.appendChild(menuOpaqueToggle);
        menu.appendChild(menuOpaqueContainer);

        // Button visibility toggle
        const buttonsVisibleContainer = document.createElement('div');
        buttonsVisibleContainer.style.display = 'flex';
        buttonsVisibleContainer.style.flexDirection = 'column';
        buttonsVisibleContainer.style.alignItems = 'center';

        const buttonsVisibleLabel = document.createElement('label');
        buttonsVisibleLabel.innerText = 'Show Buttons: ';
        buttonsVisibleLabel.style.marginBottom = '5px';

        const buttonsVisibleToggle = document.createElement('button');
        buttonsVisibleToggle.innerText = buttonsVisible ? 'Hide Buttons' : 'Show Buttons';
        buttonsVisibleToggle.addEventListener('click', () => {
            buttonsVisible = !buttonsVisible;
            buttonsVisibleToggle.innerText = buttonsVisible ? 'Hide Buttons' : 'Show Buttons';
            updateButtonsVisibility(buttonsVisible);
        });

        buttonsVisibleContainer.appendChild(buttonsVisibleLabel);
        buttonsVisibleContainer.appendChild(buttonsVisibleToggle);
        menu.appendChild(buttonsVisibleContainer);

        // Button outline toggle
        const buttonOutlineContainer = document.createElement('div');
        buttonOutlineContainer.style.display = 'flex';
        buttonOutlineContainer.style.flexDirection = 'column';
        buttonOutlineContainer.style.alignItems = 'center';

        const buttonOutlineLabel = document.createElement('label');
        buttonOutlineLabel.innerText = 'Button Outline: ';
        buttonOutlineLabel.style.marginBottom = '5px';

        const buttonOutlineToggle = document.createElement('button');
        buttonOutlineToggle.innerText = buttonOutline ? 'Disable Outline' : 'Enable Outline';
        buttonOutlineToggle.addEventListener('click', () => {
            buttonOutline = !buttonOutline;
            buttonOutlineToggle.innerText = buttonOutline ? 'Disable Outline' : 'Enable Outline';
            updateButtonOutline(buttonOutline);
        });

        buttonOutlineContainer.appendChild(buttonOutlineLabel);
        buttonOutlineContainer.appendChild(buttonOutlineToggle);
        menu.appendChild(buttonOutlineContainer);

        // Button position sliders
        const positionXContainer = document.createElement('div');
        positionXContainer.style.display = 'flex';
        positionXContainer.style.flexDirection = 'column';
        positionXContainer.style.alignItems = 'center';

        const positionXLabel = document.createElement('label');
        positionXLabel.innerText = 'Horizontal Position: ';
        positionXLabel.style.marginBottom = '5px';

        const positionXSlider = document.createElement('input');
        positionXSlider.type = 'range';
        positionXSlider.min = '-50'; // Extended range for horizontal position
        positionXSlider.max = '150'; // Extended range for horizontal position
        positionXSlider.value = buttonPositionX;
        positionXSlider.addEventListener('input', function() {
            buttonPositionX = parseInt(positionXSlider.value, 10);
            updateButtonPosition();
        });

        positionXContainer.appendChild(positionXLabel);
        positionXContainer.appendChild(positionXSlider);
        menu.appendChild(positionXContainer);

        const positionYContainer = document.createElement('div');
        positionYContainer.style.display = 'flex';
        positionYContainer.style.flexDirection = 'column';
        positionYContainer.style.alignItems = 'center';

        const positionYLabel = document.createElement('label');
        positionYLabel.innerText = 'Vertical Position: ';
        positionYLabel.style.marginBottom = '5px';

        const positionYSlider = document.createElement('input');
        positionYSlider.type = 'range';
        positionYSlider.min = '0';
        positionYSlider.max = '100';
        positionYSlider.value = buttonPositionY;
        positionYSlider.addEventListener('input', function() {
            buttonPositionY = parseInt(positionYSlider.value, 10);
            updateButtonPosition();
        });

        positionYContainer.appendChild(positionYLabel);
        positionYContainer.appendChild(positionYSlider);
        menu.appendChild(positionYContainer);

        // Reset to defaults button
        const resetContainer = document.createElement('div');
        resetContainer.style.display = 'flex';
        resetContainer.style.flexDirection = 'column';
        resetContainer.style.alignItems = 'center';

        const resetButton = document.createElement('button');
        resetButton.innerText = 'Reset to Defaults';
        resetButton.addEventListener('click', () => {
            resetToDefaults();
        });

        resetContainer.appendChild(resetButton);
        menu.appendChild(resetContainer);

        document.body.appendChild(menu);

        // Event listener for Ctrl + O
        document.addEventListener('keydown', function(event) {
            if (event.ctrlKey && event.key === 'o') {
                event.preventDefault();
                colorMenuVisible = !colorMenuVisible;
                if (colorMenuVisible) {
                    menu.style.display = 'grid';
                    setTimeout(() => {
                        menu.style.opacity = '1';
                        menu.style.transform = 'translate(-50%, -50%) scale(1)';
                    }, 10);
                } else {
                    menu.style.opacity = '0';
                    menu.style.transform = 'translate(-50%, -50%) scale(0.9)';
                    setTimeout(() => {
                        menu.style.display = 'none';
                    }, 300);
                }
            }
        });

        // Helper functions
        function updateButtonSize(newSize) {
            Object.values(buttonElements).forEach(button => {
                button.style.width = `${newSize}px`;
                button.style.height = `${newSize}px`;
            });
            localStorage.setItem('keybindButtonSize', newSize.toString());
        }

        function updateButtonOpacity(newOpacity) {
            container.style.opacity = newOpacity;
            localStorage.setItem('keybindButtonOpacity', newOpacity.toString());
        }

        function updateButtonShape(newShape) {
            Object.values(buttonElements).forEach(button => {
                button.style.borderRadius = newShape === 'circle' ? '50%' : '0';
            });
            localStorage.setItem('keybindButtonShape', newShape);
        }

        function applyTheme(theme) {
            isDarkMode = theme === 'dark';
            menu.style.backgroundColor = menuOpaque ? (isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)') : menuBackground;
            menu.style.color = isDarkMode ? 'white' : 'black';
            Object.values(buttonElements).forEach(button => {
                button.style.border = buttonOutline ? `${borderThickness}px solid ${isDarkMode ? 'black' : 'white'}` : 'none';
            });
            localStorage.setItem('keybindTheme', theme);
        }

        function updateMenuBackground(background) {
            menuBackground = background;
            menu.style.backgroundColor = menuOpaque ? (isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)') : background;
            localStorage.setItem('keybindMenuBackground', background);
        }

        function updateMenuBlur(blur) {
            menuBlur = blur;
            menu.style.backdropFilter = blur ? 'blur(10px)' : 'none';
            localStorage.setItem('keybindMenuBlur', blur.toString());
        }

        function updateMenuOpaque(opaque) {
            menuOpaque = opaque;
            menu.style.backgroundColor = opaque ? (isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)') : menuBackground;
            localStorage.setItem('keybindMenuOpaque', opaque.toString());
        }

        function updateButtonsVisibility(visible) {
            container.style.display = visible ? 'flex' : 'none';
            localStorage.setItem('keybindButtonsVisible', visible.toString());
        }

        function updateButtonOutline(outline) {
            buttonOutline = outline;
            Object.values(buttonElements).forEach(button => {
                button.style.border = outline ? `${borderThickness}px solid ${isDarkMode ? 'black' : 'white'}` : 'none';
            });
            localStorage.setItem('keybindButtonOutline', outline.toString());
        }

        function updateButtonPosition() {
            container.style.left = `${buttonPositionX}px`;
            container.style.top = `${buttonPositionY}%`;
            localStorage.setItem('keybindButtonPositionX', buttonPositionX.toString());
            localStorage.setItem('keybindButtonPositionY', buttonPositionY.toString());
        }

        function resetToDefaults() {
            buttonColors = { ...defaultSettings.keybindColors };
            buttonSize = parseInt(defaultSettings.keybindButtonSize, 10);
            buttonOpacity = parseFloat(defaultSettings.keybindButtonOpacity);
            pressedColor = defaultSettings.keybindPressedColor;
            fontSize = parseInt(defaultSettings.keybindFontSize, 10);
            borderThickness = parseInt(defaultSettings.keybindBorderThickness, 10);
            buttonShape = defaultSettings.keybindButtonShape;
            currentTheme = defaultSettings.keybindTheme;
            menuBackground = defaultSettings.keybindMenuBackground;
            menuBlur = defaultSettings.keybindMenuBlur === 'true';
            menuOpaque = defaultSettings.keybindMenuOpaque === 'true';
            buttonsVisible = defaultSettings.keybindButtonsVisible === 'true';
            buttonOutline = defaultSettings.keybindButtonOutline === 'true';
            buttonPositionX = parseInt(defaultSettings.keybindButtonPositionX, 10);
            buttonPositionY = parseInt(defaultSettings.keybindButtonPositionY, 10);

            // Update UI
            keys.forEach(key => {
                const button = document.getElementById(key.id);
                button.style.backgroundColor = buttonColors[key.id];
            });
            updateButtonSize(buttonSize);
            updateButtonOpacity(buttonOpacity);
            updateButtonShape(buttonShape);
            applyTheme(currentTheme);
            updateMenuBackground(menuBackground);
            updateMenuBlur(menuBlur);
            updateMenuOpaque(menuOpaque);
            updateButtonsVisibility(buttonsVisible);
            updateButtonOutline(buttonOutline);
            updateButtonPosition();

            // Update settings menu
            pressedColorInput.value = pressedColor;
            sizeSlider.value = buttonSize;
            opacitySlider.value = buttonOpacity;
            shapeToggle.innerText = buttonShape === 'circle' ? 'Switch to Square' : 'Switch to Circle';
            themeDropdown.value = currentTheme;
            menuBackgroundDropdown.value = menuBackground;
            menuBlurToggle.innerText = menuBlur ? 'Disable Blur' : 'Enable Blur';
            menuOpaqueToggle.innerText = menuOpaque ? 'Disable Opaque' : 'Enable Opaque';
            buttonsVisibleToggle.innerText = buttonsVisible ? 'Hide Buttons' : 'Show Buttons';
            buttonOutlineToggle.innerText = buttonOutline ? 'Disable Outline' : 'Enable Outline';
            positionXSlider.value = buttonPositionX;
            positionYSlider.value = buttonPositionY;

            // Save defaults to localStorage
            localStorage.setItem('keybindColors', JSON.stringify(buttonColors));
            localStorage.setItem('keybindButtonSize', buttonSize.toString());
            localStorage.setItem('keybindButtonOpacity', buttonOpacity.toString());
            localStorage.setItem('keybindPressedColor', pressedColor);
            localStorage.setItem('keybindFontSize', fontSize.toString());
            localStorage.setItem('keybindBorderThickness', borderThickness.toString());
            localStorage.setItem('keybindButtonShape', buttonShape);
            localStorage.setItem('keybindTheme', currentTheme);
            localStorage.setItem('keybindMenuBackground', menuBackground);
            localStorage.setItem('keybindMenuBlur', menuBlur.toString());
            localStorage.setItem('keybindMenuOpaque', menuOpaque.toString());
            localStorage.setItem('keybindButtonsVisible', buttonsVisible.toString());
            localStorage.setItem('keybindButtonOutline', buttonOutline.toString());
            localStorage.setItem('keybindButtonPositionX', buttonPositionX.toString());
            localStorage.setItem('keybindButtonPositionY', buttonPositionY.toString());
        }

        // Add Export Settings Button
        const exportContainer = document.createElement('div');
        exportContainer.style.display = 'flex';
        exportContainer.style.flexDirection = 'column';
        exportContainer.style.alignItems = 'center';

        const exportButton = document.createElement('button');
        exportButton.innerText = 'Export Settings';
        exportButton.addEventListener('click', exportSettings);

        exportContainer.appendChild(exportButton);
        menu.appendChild(exportContainer);

        // Add Import Settings Button
        const importContainer = document.createElement('div');
        importContainer.style.display = 'flex';
        importContainer.style.flexDirection = 'column';
        importContainer.style.alignItems = 'center';

        const importButton = document.createElement('button');
        importButton.innerText = 'Import Settings';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', importSettings);
        importButton.addEventListener('click', () => fileInput.click());

        importContainer.appendChild(importButton);
        importContainer.appendChild(fileInput);
        menu.appendChild(importContainer);

        // Export Settings Function
        function exportSettings() {
            const settings = {
                keybindColors: JSON.parse(localStorage.getItem('keybindColors')) || defaultSettings.keybindColors,
                keybindButtonSize: localStorage.getItem('keybindButtonSize') || defaultSettings.keybindButtonSize,
                keybindButtonOpacity: localStorage.getItem('keybindButtonOpacity') || defaultSettings.keybindButtonOpacity,
                keybindPressedColor: localStorage.getItem('keybindPressedColor') || defaultSettings.keybindPressedColor,
                keybindFontSize: localStorage.getItem('keybindFontSize') || defaultSettings.keybindFontSize,
                keybindBorderThickness: localStorage.getItem('keybindBorderThickness') || defaultSettings.keybindBorderThickness,
                keybindDarkMode: localStorage.getItem('keybindDarkMode') || defaultSettings.keybindDarkMode,
                keybindButtonShape: localStorage.getItem('keybindButtonShape') || defaultSettings.keybindButtonShape,
                keybindTheme: localStorage.getItem('keybindTheme') || defaultSettings.keybindTheme,
                keybindMenuBackground: localStorage.getItem('keybindMenuBackground') || defaultSettings.keybindMenuBackground,
                keybindMenuBlur: localStorage.getItem('keybindMenuBlur') || defaultSettings.keybindMenuBlur,
                keybindMenuOpaque: localStorage.getItem('keybindMenuOpaque') || defaultSettings.keybindMenuOpaque,
                keybindButtonsVisible: localStorage.getItem('keybindButtonsVisible') || defaultSettings.keybindButtonsVisible,
                keybindButtonOutline: localStorage.getItem('keybindButtonOutline') || defaultSettings.keybindButtonOutline,
                keybindButtonPositionX: localStorage.getItem('keybindButtonPositionX') || defaultSettings.keybindButtonPositionX,
                keybindButtonPositionY: localStorage.getItem('keybindButtonPositionY') || defaultSettings.keybindButtonPositionY,
            };

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "keybind_settings.json");
            document.body.appendChild(downloadAnchorNode); // Required for Firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }

        // Import Settings Function
        function importSettings(event) {
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                const settings = JSON.parse(text);

                // Update localStorage with imported settings
                localStorage.setItem('keybindColors', JSON.stringify(settings.keybindColors));
                localStorage.setItem('keybindButtonSize', settings.keybindButtonSize);
                localStorage.setItem('keybindButtonOpacity', settings.keybindButtonOpacity);
                localStorage.setItem('keybindPressedColor', settings.keybindPressedColor);
                localStorage.setItem('keybindFontSize', settings.keybindFontSize);
                localStorage.setItem('keybindBorderThickness', settings.keybindBorderThickness);
                localStorage.setItem('keybindDarkMode', settings.keybindDarkMode);
                localStorage.setItem('keybindButtonShape', settings.keybindButtonShape);
                localStorage.setItem('keybindTheme', settings.keybindTheme);
                localStorage.setItem('keybindMenuBackground', settings.keybindMenuBackground);
                localStorage.setItem('keybindMenuBlur', settings.keybindMenuBlur);
                localStorage.setItem('keybindMenuOpaque', settings.keybindMenuOpaque);
                localStorage.setItem('keybindButtonsVisible', settings.keybindButtonsVisible);
                localStorage.setItem('keybindButtonOutline', settings.keybindButtonOutline);
                localStorage.setItem('keybindButtonPositionX', settings.keybindButtonPositionX);
                localStorage.setItem('keybindButtonPositionY', settings.keybindButtonPositionY);

                // Reload the page to apply new settings
                window.location.reload();
            };
            reader.readAsText(file);
        }
    });
})();