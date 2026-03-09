(function() {
    const CONFIG_URL = 'colorizer_config.json';
    const CONFIG_FALLBACK_KEY = 'COLORIZER_CONFIG';
    const STORAGE_KEY = 'colorizer_state_v2';
    const DEFAULT_FALLBACK_VIEW = 'long';
    const DEFAULT_UPLOAD_LABEL = 'Файл не выбран';
    const DEFAULT_UPLOADED_PHOTO_LABEL = 'Загруженное фото';
    const DEFAULT_SECTION_ORDER = ['views', 'blocks', 'types', 'textureColors', 'metalColors'];
    const DEFAULT_DOWNLOAD_BUTTON = {
        enabled: true,
        label: 'Скачать',
        ariaLabel: 'Скачать изображение'
    };
    const DEFAULT_SWATCH_FALLBACK_COLOR = '#8d9398';
    const DEFAULT_NO_IMAGE_NOTICE = 'Нет изображения для этой комбинации.';
    const DEFAULT_CONFIG_LOAD_FAILED_NOTICE = 'Не удалось загрузить настройки конструктора.';
    const DEFAULT_SECTION_LABELS = {
        views: 'Вид',
        blocks: 'Текстуры',
        types: 'Наполнение',
        metals: 'Цвет текстуры',
        fillMetals: 'Цвет металла'
    };
    const DEFAULT_VIEW_LABELS = {
        regular: 'Вид',
        long: 'Длинный'
    };
    const BOOT_CONFIG = (function () {
        const raw = window[CONFIG_FALLBACK_KEY];
        return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
    })();
    const BOOT_SETTINGS = readBootSettings(BOOT_CONFIG);

    let defaultBackground = BOOT_SETTINGS.defaultBackground;
    let notices = BOOT_SETTINGS.notices;
    let labels = BOOT_SETTINGS.labels;
    let dynamicData = {
        withoutTextureId: 'without_texture',
        textureOrder: [],
        textures: {},
        defaultFillMetalColors: [],
        fills: {
            withTexture: {},
            withoutTexture: {}
        }
    };
    let uiSettings = BOOT_SETTINGS.uiSettings;
    let allowedViews = BOOT_SETTINGS.allowedViews;
    let defaultView = BOOT_SETTINGS.defaultView;
    let emptyUploadLabel = BOOT_SETTINGS.emptyUploadLabel;
    let uploadedPhotoLabel = BOOT_SETTINGS.uploadedPhotoLabel;
    let swatchFallbackColor = BOOT_SETTINGS.swatchFallbackColor;
    let blockOrder = [];
    let selectedMetalByBlock = {};
    let selectedFillMetalByType = {};
    let previewLayoutSchema = BOOT_SETTINGS.previewLayoutSchema;
    let settingsSectionSchema = BOOT_SETTINGS.settingsSectionSchema;

    const colorizerRoot = document.querySelector('.colorizer');
    const previewPane = document.querySelector('.colorizer__preview');
    const settingsPanel = document.querySelector('.colorizer__settings');
    const settingsCta = document.getElementById('settingsCta');

    mountStaticLayout();

    const bgImg = document.getElementById('previewBg');
    const overlayFill = document.getElementById('overlayFill');
    const overlayFront = document.getElementById('overlayFront');
    const overlayNotice = document.getElementById('overlayNotice');
    const fileInput = document.getElementById('uploadBg');
    const dropZone = document.getElementById('dropZone');
    const pickBtn = document.getElementById('pickBg');
    const uploadName = document.getElementById('uploadName');
    const uploadPreviewWrap = document.getElementById('uploadPreviewWrap');
    const uploadPreview = document.getElementById('uploadPreview');
    const clearBtn = document.getElementById('clearBg');
    const downloadPreviewBtn = document.getElementById('downloadPreview');
    const blockSection = document.getElementById('blockSection');
    const typeSection = document.getElementById('typeSection');
    const metalSection = document.getElementById('metalSection');
    const fillMetalSection = document.getElementById('fillMetalSection');
    const viewSection = document.getElementById('viewSection');

    const blockGroup = document.getElementById('blockGroup');
    const typeGroup = document.getElementById('typeGroup');
    const metalGroup = document.getElementById('metalGroup');
    const fillMetalGroup = document.getElementById('fillMetalGroup');
    const viewGroup = document.getElementById('viewGroup');
    const exampleList = document.querySelector('.colorizer__examples');

    const state = {
        block: '',
        type: '',
        metal: '',
        fillMetal: '',
        view: defaultView
    };

    let uploadedFileName = '';
    let swatchMap = {};
    let previewLoadRequestId = 0;
    const tintedFillCache = new Map();

    function isObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function buildDefaultPreviewLayoutSchema(backgroundSrc, downloadButton) {
        const label = downloadButton && typeof downloadButton.label === 'string' && downloadButton.label.trim()
            ? downloadButton.label
            : DEFAULT_DOWNLOAD_BUTTON.label;
        const ariaLabel = downloadButton && typeof downloadButton.ariaLabel === 'string' && downloadButton.ariaLabel.trim()
            ? downloadButton.ariaLabel
            : DEFAULT_DOWNLOAD_BUTTON.ariaLabel;
        const backgroundAttrs = {
            id: 'previewBg',
            alt: 'фон'
        };

        if (backgroundSrc) {
            backgroundAttrs.src = backgroundSrc;
        }

        return [
            {
                tag: 'img',
                className: 'colorizer__bg',
                attrs: backgroundAttrs
            },
            {
                tag: 'div',
                className: 'colorizer__overlay colorizer__overlay--fill',
                attrs: { id: 'overlayFill' }
            },
            {
                tag: 'div',
                className: 'colorizer__overlay colorizer__overlay--front',
                attrs: { id: 'overlayFront' }
            },
            {
                tag: 'div',
                className: 'overlay-notice',
                attrs: { id: 'overlayNotice', hidden: '' }
            },
            {
                tag: 'button',
                className: 'colorizer__download-btn',
                attrs: {
                    type: 'button',
                    id: 'downloadPreview',
                    'aria-label': ariaLabel
                },
                children: [
                    {
                        tag: 'i',
                        className: 'bi bi-download',
                        attrs: { 'aria-hidden': 'true' }
                    },
                    {
                        tag: 'span',
                        text: label
                    }
                ]
            }
        ];
    }

    function sectionLabelByKey(key, sectionLabels) {
        const labelsMap = isObject(sectionLabels) ? sectionLabels : DEFAULT_SECTION_LABELS;
        const normalizedKey = String(key || '').trim();
        if (normalizedKey === 'views') return labelsMap.views;
        if (normalizedKey === 'blocks') return labelsMap.blocks;
        if (normalizedKey === 'types') return labelsMap.types;
        if (normalizedKey === 'textureColors') return labelsMap.metals;
        if (normalizedKey === 'metalColors') return labelsMap.fillMetals;
        return '';
    }

    function buildDefaultSettingsSectionSchema(sectionLabels) {
        return [
            { key: 'views', sectionId: 'viewSection', groupId: 'viewGroup', label: sectionLabelByKey('views', sectionLabels) },
            { key: 'blocks', sectionId: 'blockSection', groupId: 'blockGroup', label: sectionLabelByKey('blocks', sectionLabels) },
            { key: 'types', sectionId: 'typeSection', groupId: 'typeGroup', label: sectionLabelByKey('types', sectionLabels) },
            { key: 'textureColors', sectionId: 'metalSection', groupId: 'metalGroup', label: sectionLabelByKey('textureColors', sectionLabels) },
            { key: 'metalColors', sectionId: 'fillMetalSection', groupId: 'fillMetalGroup', label: sectionLabelByKey('metalColors', sectionLabels) }
        ];
    }

    function normalizeAllowedViews(rawValue) {
        if (!Array.isArray(rawValue)) return [DEFAULT_FALLBACK_VIEW];

        const uniqueViews = [];
        const seen = new Set();
        rawValue.forEach((item) => {
            const value = String(item || '').trim();
            if (!value || seen.has(value)) return;
            if (!(value === 'regular' || value === 'long' || /^long_v\d+$/i.test(value))) return;
            seen.add(value);
            uniqueViews.push(value);
        });

        return uniqueViews.length ? uniqueViews : [DEFAULT_FALLBACK_VIEW];
    }

    function normalizePreviewLayoutSchema(rawValue, backgroundSrc, downloadButton) {
        const fallback = buildDefaultPreviewLayoutSchema(backgroundSrc, downloadButton);
        if (!Array.isArray(rawValue) || !rawValue.length) return clonePlainData(fallback);

        const schema = clonePlainData(rawValue);
        schema.forEach((node) => {
            if (!isObject(node)) return;
            if (!isObject(node.attrs)) node.attrs = {};

            if (node.attrs.id === 'previewBg' && backgroundSrc && !String(node.attrs.src || '').trim()) {
                node.attrs.src = backgroundSrc;
            }

            if (node.attrs.id === 'downloadPreview' && !String(node.attrs['aria-label'] || '').trim()) {
                node.attrs['aria-label'] = downloadButton.ariaLabel || DEFAULT_DOWNLOAD_BUTTON.ariaLabel;
            }
        });

        return schema;
    }

    function normalizeSettingsSectionSchema(rawValue, sectionLabels) {
        const fallback = buildDefaultSettingsSectionSchema(sectionLabels);
        if (!Array.isArray(rawValue) || !rawValue.length) return clonePlainData(fallback);

        const normalized = rawValue.map((item, index) => {
            if (!isObject(item)) return null;

            const fallbackItem = fallback[index] || fallback[0];
            const key = String(item.key || fallbackItem.key || '').trim();
            const sectionId = String(item.sectionId || fallbackItem.sectionId || '').trim();
            const groupId = String(item.groupId || fallbackItem.groupId || '').trim();
            if (!key || !sectionId || !groupId) return null;

            return {
                key: key,
                sectionId: sectionId,
                groupId: groupId,
                label: typeof item.label === 'string' ? item.label : sectionLabelByKey(key, sectionLabels),
                className: typeof item.className === 'string' && item.className.trim() ? item.className : 'fence-group',
                labelClassName: typeof item.labelClassName === 'string' && item.labelClassName.trim() ? item.labelClassName : 'fence-group__label',
                groupClassName: typeof item.groupClassName === 'string' && item.groupClassName.trim() ? item.groupClassName : 'fence-group__options'
            };
        }).filter(Boolean);

        return normalized.length ? normalized : clonePlainData(fallback);
    }

    function readBootSettings(config) {
        const source = isObject(config) ? config : {};
        const assets = isObject(source.assets) ? source.assets : {};
        const behavior = isObject(source.behavior) ? source.behavior : {};
        const labelsConfig = isObject(source.labels) ? source.labels : {};
        const ui = isObject(source.ui) ? source.ui : {};
        const layout = isObject(ui.layout) ? ui.layout : {};
        const upload = isObject(ui.upload) ? ui.upload : {};
        const downloadButton = isObject(ui.downloadButton) ? ui.downloadButton : {};
        const defaultState = isObject(behavior.defaultState) ? behavior.defaultState : {};
        const sectionLabels = Object.assign({}, DEFAULT_SECTION_LABELS, isObject(labelsConfig.sections) ? labelsConfig.sections : {});
        const viewLabels = Object.assign({}, DEFAULT_VIEW_LABELS, isObject(labelsConfig.views) ? labelsConfig.views : {});
        const allowed = normalizeAllowedViews(behavior.allowedViews);
        const requestedView = String(defaultState.view || '').trim();
        const resolvedDownloadButton = {
            enabled: typeof downloadButton.enabled === 'boolean' ? downloadButton.enabled : DEFAULT_DOWNLOAD_BUTTON.enabled,
            label: typeof downloadButton.label === 'string' && downloadButton.label.trim() ? downloadButton.label : DEFAULT_DOWNLOAD_BUTTON.label,
            ariaLabel: typeof downloadButton.ariaLabel === 'string' && downloadButton.ariaLabel.trim() ? downloadButton.ariaLabel : DEFAULT_DOWNLOAD_BUTTON.ariaLabel
        };
        const resolvedDefaultBackground = typeof assets.defaultBackground === 'string' && assets.defaultBackground.trim()
            ? assets.defaultBackground.trim()
            : '';
        const resolvedDefaultView = requestedView && allowed.indexOf(requestedView) !== -1
            ? requestedView
            : (allowed[0] || DEFAULT_FALLBACK_VIEW);

        return {
            defaultBackground: resolvedDefaultBackground,
            notices: Object.assign({
                noImage: DEFAULT_NO_IMAGE_NOTICE,
                configLoadFailed: DEFAULT_CONFIG_LOAD_FAILED_NOTICE
            }, isObject(behavior.notices) ? behavior.notices : {}),
            labels: Object.assign({
                withoutTexture: 'Без текстур'
            }, labelsConfig, {
                sections: sectionLabels,
                views: viewLabels
            }),
            uiSettings: {
                sectionOrder: Array.isArray(ui.sectionOrder) && ui.sectionOrder.length ? ui.sectionOrder.slice() : DEFAULT_SECTION_ORDER.slice(),
                downloadButton: resolvedDownloadButton
            },
            allowedViews: allowed,
            defaultView: resolvedDefaultView,
            emptyUploadLabel: typeof upload.emptyLabel === 'string' && upload.emptyLabel.trim() ? upload.emptyLabel : DEFAULT_UPLOAD_LABEL,
            uploadedPhotoLabel: typeof upload.loadedLabel === 'string' && upload.loadedLabel.trim() ? upload.loadedLabel : DEFAULT_UPLOADED_PHOTO_LABEL,
            swatchFallbackColor: isHexColor(behavior.swatchFallbackColor) ? behavior.swatchFallbackColor : DEFAULT_SWATCH_FALLBACK_COLOR,
            previewLayoutSchema: normalizePreviewLayoutSchema(layout.preview, resolvedDefaultBackground, resolvedDownloadButton),
            settingsSectionSchema: normalizeSettingsSectionSchema(layout.sections, sectionLabels)
        };
    }

    function getFallbackView() {
        return String(defaultView || allowedViews[0] || DEFAULT_FALLBACK_VIEW);
    }

    function getDefaultViewOrder() {
        return Array.isArray(allowedViews) && allowedViews.length ? allowedViews.slice() : [getFallbackView()];
    }

    function createElementFromSchema(schema) {
        const element = document.createElement(schema.tag || 'div');
        if (schema.className) element.className = schema.className;
        if (schema.text) element.textContent = schema.text;

        const attrs = isObject(schema.attrs) ? schema.attrs : {};
        Object.keys(attrs).forEach((name) => {
            const value = attrs[name];
            if (typeof value === 'boolean') {
                if (value) element.setAttribute(name, '');
                return;
            }
            element.setAttribute(name, String(value));
        });

        const children = Array.isArray(schema.children) ? schema.children : [];
        children.forEach((child) => {
            element.appendChild(createElementFromSchema(child));
        });

        return element;
    }

    function createSettingsSection(section) {
        return createElementFromSchema({
            tag: 'div',
            className: section.className || 'fence-group',
            attrs: { id: section.sectionId },
            children: [
                {
                    tag: 'div',
                    className: section.labelClassName || 'fence-group__label',
                    text: section.label
                },
                {
                    tag: 'div',
                    className: section.groupClassName || 'fence-group__options',
                    attrs: { id: section.groupId }
                }
            ]
        });
    }

    function mountStaticLayout() {
        if (previewPane) {
            previewPane.innerHTML = '';
            previewLayoutSchema.forEach((item) => {
                previewPane.appendChild(createElementFromSchema(item));
            });
        }

        if (settingsPanel) {
            settingsPanel.innerHTML = '';
            settingsSectionSchema.forEach((section) => {
                settingsPanel.appendChild(createSettingsSection(section));
            });
        }
    }

    function clonePlainData(value) {
        if (typeof value === 'undefined') return null;
        return JSON.parse(JSON.stringify(value));
    }

    function isFileProtocol() {
        return window.location.protocol === 'file:';
    }

    function setBootState(isBooting) {
        if (!colorizerRoot) return;
        colorizerRoot.classList.toggle('is-booting', !!isBooting);
    }

    function setPreviewLoading(isLoading, requestId) {
        if (!previewPane) return;
        if (typeof requestId === 'number' && requestId !== previewLoadRequestId) return;
        previewPane.classList.toggle('is-loading', !!isLoading);
    }

    function startPreviewLoading() {
        previewLoadRequestId += 1;
        setPreviewLoading(true, previewLoadRequestId);
        return previewLoadRequestId;
    }

    function getKeys(obj) {
        return Object.keys(isObject(obj) ? obj : {});
    }

    function firstKey(obj) {
        const keys = getKeys(obj);
        return keys.length ? keys[0] : '';
    }

    function firstExisting(preferred, obj) {
        if (preferred && isObject(obj) && Object.prototype.hasOwnProperty.call(obj, preferred)) {
            return preferred;
        }
        return firstKey(obj);
    }

    function titleFromKey(key) {
        const s = String(key || '').replace(/[-_]+/g, ' ').trim();
        if (!s) return '';
        return s.replace(/(^|\s)\S/g, (m) => m.toUpperCase());
    }

    function toText(value, fallback) {
        if (typeof value === 'string' && value.trim()) return value;
        return fallback;
    }

    function normalizeColorToken(value) {
        return String(value || '').toLowerCase().replace(/[\s_-]+/g, '');
    }

    function buildSwatchMap(rawMap) {
        const out = {};
        if (!isObject(rawMap)) return out;

        getKeys(rawMap).forEach((key) => {
            const normalizedKey = normalizeColorToken(key);
            const value = String(rawMap[key] || '').trim();
            if (!normalizedKey) return;
            if (!/^#([0-9a-f]{6})$/i.test(value)) return;
            out[normalizedKey] = value;
        });

        return out;
    }

    function clampColor(value) {
        return Math.max(0, Math.min(255, value));
    }

    function shiftHexColor(hex, delta) {
        const normalized = String(hex || '').trim();
        const match = normalized.match(/^#([0-9a-f]{6})$/i);
        if (!match) return '#9aa0a6';

        const raw = match[1];
        const r = clampColor(parseInt(raw.slice(0, 2), 16) + delta);
        const g = clampColor(parseInt(raw.slice(2, 4), 16) + delta);
        const b = clampColor(parseInt(raw.slice(4, 6), 16) + delta);

        const out = [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
        return '#' + out;
    }

    function isHexColor(value) {
        return /^#([0-9a-f]{6})$/i.test(String(value || '').trim());
    }

    function guessedColorByKey(colorKey) {
        const key = normalizeColorToken(colorKey);
        const match = key.match(/^([a-z]+)(\d+)?$/);
        const baseKey = match ? match[1] : key;
        const index = match && match[2] ? parseInt(match[2], 10) : 0;

        const base = swatchMap[baseKey] || swatchFallbackColor;
        if (!index) return base;

        const shifts = [0, 14, -14, 22, -22, 30, -30];
        const shift = shifts[index % shifts.length];
        return shiftHexColor(base, shift);
    }

    function colorNodeSwatch(colorKey, colorNode) {
        if (colorNode && typeof colorNode.swatch === 'string' && colorNode.swatch.trim()) {
            return colorNode.swatch.trim();
        }
        return guessedColorByKey(colorKey);
    }

    function normalizeKeyedCollection(raw, idField) {
        const out = {};

        if (Array.isArray(raw)) {
            raw.forEach((item) => {
                if (!isObject(item)) return;
                const id = toText(item[idField], '');
                if (!id) return;
                out[id] = item;
            });
            return out;
        }

        if (isObject(raw)) {
            return raw;
        }

        return out;
    }

    function normalizeTextureNode(node) {
        if (!isObject(node)) return null;
        const normalized = Object.assign({}, node);
        normalized.colors = normalizeKeyedCollection(node.colors, 'id');
        return normalized;
    }

    function normalizeTextures(rawTextures) {
        const map = {};
        const order = [];

        if (Array.isArray(rawTextures)) {
            rawTextures.forEach((item) => {
                if (!isObject(item)) return;
                const id = toText(item.id, '');
                if (!id) return;
                map[id] = normalizeTextureNode(item);
                order.push(id);
            });
            return { map, order };
        }

        if (isObject(rawTextures)) {
            getKeys(rawTextures).forEach((id) => {
                map[id] = normalizeTextureNode(rawTextures[id]);
                order.push(id);
            });
        }

        return { map, order };
    }

    function knownColorLabelById(colorId) {
        const token = String(colorId || '').trim();
        if (!token) return '';

        const textures = isObject(dynamicData.textures) ? dynamicData.textures : {};
        const textureKeys = getKeys(textures);
        for (const textureKey of textureKeys) {
            const textureNode = textures[textureKey];
            if (!textureNode || !isObject(textureNode.colors)) continue;
            const colorNode = textureNode.colors[token];
            if (!colorNode || !isObject(colorNode)) continue;
            const label = toText(colorNode.label, '');
            if (label) return label;
        }

        return titleFromKey(token);
    }

    function extractFillMetalImageVariants(rawNode) {
        const out = {};
        const source = isObject(rawNode) ? rawNode : {};

        getKeys(source).forEach((key) => {
            if (!(key === 'regular' || key === 'long' || /^long_v\d+$/i.test(key))) return;
            const value = toText(source[key], '');
            if (!value) return;
            out[key] = value;
        });

        return out;
    }

    function buildFillMetalNode(id, rawNode, labelFallback) {
        const source = isObject(rawNode) ? rawNode : {};
        const fallbackColor = guessedColorByKey(id);
        const texture = toText(source.texture || source.image || source.pattern, '');
        const imageVariants = extractFillMetalImageVariants(source);
        const swatch = toText(source.swatch, '');
        const color = toText(source.color, isHexColor(swatch) ? swatch : fallbackColor);

        return {
            label: toText(source.label, labelFallback),
            swatch: toText(swatch, color),
            color: isHexColor(color) ? color : fallbackColor,
            texture: texture,
            imageVariants: imageVariants
        };
    }

    function normalizeFillMetals(rawValue) {
        const out = {};

        if (Array.isArray(rawValue)) {
            rawValue.forEach((item) => {
                if (typeof item === 'string') {
                    const id = item.trim();
                    if (!id) return;
                    out[id] = buildFillMetalNode(id, {}, knownColorLabelById(id));
                    return;
                }
                if (!isObject(item)) return;
                const id = toText(item.id, '');
                if (!id) return;
                out[id] = buildFillMetalNode(id, item, knownColorLabelById(id));
            });
            return out;
        }

        if (isObject(rawValue)) {
            getKeys(rawValue).forEach((id) => {
                const node = rawValue[id];
                if (typeof node === 'string') {
                    out[id] = buildFillMetalNode(id, { label: node.trim() || knownColorLabelById(id) }, knownColorLabelById(id));
                    return;
                }
                if (!isObject(node)) return;
                out[id] = buildFillMetalNode(id, node, knownColorLabelById(id));
            });
        }

        return out;
    }

    function isSectionEnabled(key) {
        return Array.isArray(uiSettings.sectionOrder) && uiSettings.sectionOrder.indexOf(key) !== -1;
    }

    function applySectionLayout() {
        if (!settingsPanel) return;

        const sectionsByKey = {
            views: viewSection,
            blocks: blockSection,
            types: typeSection,
            textureColors: metalSection,
            metalColors: fillMetalSection
        };

        const order = Array.isArray(uiSettings.sectionOrder) && uiSettings.sectionOrder.length
            ? uiSettings.sectionOrder.slice()
            : DEFAULT_SECTION_ORDER.slice();

        const seen = new Set();
        const insertBeforeNode = settingsCta && settingsCta.parentElement === settingsPanel ? settingsCta : null;
        order.concat(DEFAULT_SECTION_ORDER).forEach((key) => {
            if (seen.has(key)) return;
            seen.add(key);
            const section = sectionsByKey[key];
            if (!section) return;
            if (insertBeforeNode) {
                settingsPanel.insertBefore(section, insertBeforeNode);
            } else {
                settingsPanel.appendChild(section);
            }
        });
    }

    function applySectionLabel(sectionNode, rawValue, fallback) {
        if (!sectionNode) return;

        const labelNode = sectionNode.querySelector('.fence-group__label');
        if (!labelNode) return;

        if (typeof rawValue === 'string') {
            const text = rawValue.trim();
            if (!text) {
                labelNode.textContent = '';
                labelNode.hidden = true;
                return;
            }
            labelNode.textContent = rawValue;
            labelNode.hidden = false;
            return;
        }

        labelNode.textContent = fallback;
        labelNode.hidden = false;
    }

    function applySectionLabels() {
        const sectionLabels = isObject(labels.sections) ? labels.sections : {};

        applySectionLabel(viewSection, sectionLabels.views, 'Вид');
        applySectionLabel(blockSection, sectionLabels.blocks, 'Текстуры');
        applySectionLabel(typeSection, sectionLabels.types, 'Наполнение');
        applySectionLabel(metalSection, sectionLabels.metals, 'Цвет текстуры');
        applySectionLabel(fillMetalSection, sectionLabels.fillMetals, 'Цвет металла');
    }

    function applyDownloadButtonConfig() {
        if (!downloadPreviewBtn) return;

        const cfg = isObject(uiSettings.downloadButton) ? uiSettings.downloadButton : {};
        const enabled = cfg.enabled !== false;
        const label = toText(cfg.label, DEFAULT_DOWNLOAD_BUTTON.label);
        const aria = toText(cfg.ariaLabel, label + ' изображение');
        const textNode = downloadPreviewBtn.querySelector('span');

        downloadPreviewBtn.hidden = !enabled;
        downloadPreviewBtn.disabled = !enabled;
        downloadPreviewBtn.setAttribute('aria-label', aria);

        if (textNode) {
            textNode.textContent = label;
        } else {
            downloadPreviewBtn.textContent = label;
        }
    }

    function resolveVariantPath(variantNode, requestedView) {
        if (!isObject(variantNode)) return '';

        const viewQueue = [];
        const seen = new Set();
        const pushView = (name) => {
            const key = String(name || '').trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            viewQueue.push(key);
        };

        const selectedView = String(requestedView || state.view || getFallbackView());
        pushView(selectedView);
        if (/^long(_v\d+)?$/i.test(selectedView)) {
            pushView('long');
        }
        pushView('regular');
        pushView('long');

        for (const viewKey of viewQueue) {
            const candidate = variantNode[viewKey];
            if (typeof candidate === 'string' && candidate) return candidate;
        }

        return '';
    }

    function loadStoredState() {
        try {
            if (!window.localStorage) return null;
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return isObject(parsed) ? parsed : null;
        } catch (err) {
            return null;
        }
    }

    function saveStoredState() {
        try {
            if (!window.localStorage) return;
            const payload = {
                block: state.block || '',
                type: state.type || '',
                metal: state.metal || '',
                fillMetal: state.fillMetal || '',
                view: state.view || getFallbackView(),
                selectedMetalByBlock: selectedMetalByBlock,
                selectedFillMetalByType: selectedFillMetalByType,
                bgSrc: (bgImg && bgImg.src) ? String(bgImg.src) : '',
                uploadName: uploadedFileName || '',
                savedAt: Date.now()
            };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (err) {
            // Ignore storage errors.
        }
    }

    function applyStoredState(stored) {
        if (!isObject(stored)) return;
        if (typeof stored.block === 'string') state.block = stored.block;
        if (typeof stored.type === 'string') state.type = stored.type;
        if (typeof stored.metal === 'string') state.metal = stored.metal;
        if (typeof stored.fillMetal === 'string') state.fillMetal = stored.fillMetal;
        if (typeof stored.view === 'string') state.view = stored.view;
        if (isObject(stored.selectedMetalByBlock)) {
            selectedMetalByBlock = Object.assign({}, stored.selectedMetalByBlock);
        }
        if (isObject(stored.selectedFillMetalByType)) {
            selectedFillMetalByType = Object.assign({}, stored.selectedFillMetalByType);
        }
        if (typeof stored.uploadName === 'string') uploadedFileName = stored.uploadName;
        if (bgImg && typeof stored.bgSrc === 'string' && stored.bgSrc) {
            bgImg.src = stored.bgSrc;
        }
    }

    function setUploadName(text) {
        if (!uploadName) return;
        uploadName.textContent = text || emptyUploadLabel;
    }

    function setUploadThumbnail(src, visible) {
        if (!uploadPreviewWrap || !uploadPreview) return;
        const show = !!visible && !!src;
        uploadPreviewWrap.hidden = !show;
        if (show) {
            uploadPreview.src = String(src);
        } else {
            uploadPreview.removeAttribute('src');
        }
    }

    function normalizeBgSrc(src) {
        const raw = String(src || '').trim();
        if (!raw) return '';
        try {
            return new URL(raw, window.location.href).href;
        } catch (err) {
            return raw;
        }
    }

    function setImageSrcWithLoad(imgEl, src) {
        return new Promise((resolve) => {
            if (!imgEl) {
                resolve();
                return;
            }

            const target = String(src || '');
            if (!target) {
                imgEl.removeAttribute('src');
                resolve();
                return;
            }

            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                imgEl.removeEventListener('load', finish);
                imgEl.removeEventListener('error', finish);
                resolve();
            };

            imgEl.addEventListener('load', finish);
            imgEl.addEventListener('error', finish);
            imgEl.src = target;

            if (imgEl.complete) {
                setTimeout(finish, 0);
            }
        });
    }

    function setBackgroundSrc(src, withLoader) {
        if (!bgImg) return Promise.resolve();
        const useLoader = withLoader !== false;
        if (!useLoader) {
            bgImg.src = String(src || '');
            return Promise.resolve();
        }

        const requestId = startPreviewLoading();
        return setImageSrcWithLoad(bgImg, src).finally(() => {
            setPreviewLoading(false, requestId);
        });
    }

    function parseObjectPosition(rawValue) {
        const raw = String(rawValue || '').trim();
        const tokens = raw ? raw.split(/\s+/) : [];
        const xToken = tokens[0] || '50%';
        const yToken = tokens[1] || (tokens.length === 1 ? '50%' : '50%');

        const toRatio = (token, axis) => {
            const value = String(token || '').toLowerCase();
            if (value.endsWith('%')) {
                const num = parseFloat(value);
                if (!isNaN(num)) return Math.max(0, Math.min(1, num / 100));
            }
            if (value === 'left' || value === 'top') return 0;
            if (value === 'right' || value === 'bottom') return 1;
            if (value === 'center') return 0.5;
            if (!value && axis === 'x') return 0.5;
            if (!value && axis === 'y') return 0.5;
            return 0.5;
        };

        return {
            x: toRatio(xToken, 'x'),
            y: toRatio(yToken, 'y')
        };
    }

    function drawImageWithObjectFit(ctx, img, destRect, fit, position) {
        const naturalW = img.naturalWidth || img.width || 0;
        const naturalH = img.naturalHeight || img.height || 0;
        if (!naturalW || !naturalH || !destRect.width || !destRect.height) return;

        const objectFit = String(fit || 'fill').toLowerCase();
        const pos = position || { x: 0.5, y: 0.5 };

        if (objectFit === 'contain') {
            const scale = Math.min(destRect.width / naturalW, destRect.height / naturalH);
            const drawW = naturalW * scale;
            const drawH = naturalH * scale;
            const drawX = destRect.x + (destRect.width - drawW) * pos.x;
            const drawY = destRect.y + (destRect.height - drawH) * pos.y;
            ctx.drawImage(img, 0, 0, naturalW, naturalH, drawX, drawY, drawW, drawH);
            return;
        }

        if (objectFit === 'cover') {
            const scale = Math.max(destRect.width / naturalW, destRect.height / naturalH);
            const srcW = Math.min(naturalW, destRect.width / scale);
            const srcH = Math.min(naturalH, destRect.height / scale);
            const srcX = Math.max(0, (naturalW - srcW) * pos.x);
            const srcY = Math.max(0, (naturalH - srcH) * pos.y);
            ctx.drawImage(img, srcX, srcY, srcW, srcH, destRect.x, destRect.y, destRect.width, destRect.height);
            return;
        }

        ctx.drawImage(img, 0, 0, naturalW, naturalH, destRect.x, destRect.y, destRect.width, destRect.height);
    }

    function drawImageElementToCanvas(ctx, imageEl, previewRect, scale) {
        if (!imageEl || !imageEl.getBoundingClientRect) return;
        const src = String(imageEl.currentSrc || imageEl.src || '').trim();
        if (!src) return;

        const rect = imageEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const computed = window.getComputedStyle(imageEl);
        const position = parseObjectPosition(computed.objectPosition || '50% 50%');

        const destRect = {
            x: (rect.left - previewRect.left) * scale,
            y: (rect.top - previewRect.top) * scale,
            width: rect.width * scale,
            height: rect.height * scale
        };

        drawImageWithObjectFit(ctx, imageEl, destRect, computed.objectFit || 'fill', position);
    }

    function drawCanvasElementToCanvas(ctx, canvasEl, previewRect, scale) {
        if (!canvasEl || !canvasEl.getBoundingClientRect) return;
        if (!canvasEl.width || !canvasEl.height) return;

        const rect = canvasEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        ctx.drawImage(
            canvasEl,
            0,
            0,
            canvasEl.width,
            canvasEl.height,
            (rect.left - previewRect.left) * scale,
            (rect.top - previewRect.top) * scale,
            rect.width * scale,
            rect.height * scale
        );
    }

    function waitForImageReady(imageEl) {
        if (!imageEl) return Promise.resolve();
        const src = String(imageEl.currentSrc || imageEl.src || '').trim();
        if (!src) return Promise.resolve();
        if (imageEl.complete) return Promise.resolve();

        return new Promise((resolve) => {
            const finish = () => {
                imageEl.removeEventListener('load', finish);
                imageEl.removeEventListener('error', finish);
                resolve();
            };
            imageEl.addEventListener('load', finish);
            imageEl.addEventListener('error', finish);
        });
    }

    function buildDownloadFileName() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return 'fence-preview-' + now.getFullYear()
            + pad(now.getMonth() + 1)
            + pad(now.getDate()) + '-'
            + pad(now.getHours())
            + pad(now.getMinutes())
            + pad(now.getSeconds()) + '.png';
    }

    async function downloadCurrentPreview() {
        if (!previewPane) return;

        const previewRect = previewPane.getBoundingClientRect();
        if (!previewRect.width || !previewRect.height) return;

        const fillImg = overlayFill ? overlayFill.querySelector('img') : null;
        const frontImg = overlayFront ? overlayFront.querySelector('img') : null;
        const fillCanvas = overlayFill ? overlayFill.querySelector('canvas') : null;
        const frontCanvas = overlayFront ? overlayFront.querySelector('canvas') : null;
        await Promise.all([
            waitForImageReady(bgImg),
            waitForImageReady(fillImg),
            waitForImageReady(frontImg)
        ]);

        const scale = Math.max(1, window.devicePixelRatio || 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(previewRect.width * scale));
        canvas.height = Math.max(1, Math.round(previewRect.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        drawImageElementToCanvas(ctx, bgImg, previewRect, scale);
        drawImageElementToCanvas(ctx, fillImg, previewRect, scale);
        drawImageElementToCanvas(ctx, frontImg, previewRect, scale);
        drawCanvasElementToCanvas(ctx, fillCanvas, previewRect, scale);
        drawCanvasElementToCanvas(ctx, frontCanvas, previewRect, scale);

        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = buildDownloadFileName();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function setActiveExampleBySrc(src) {
        if (!exampleList) return false;
        const target = normalizeBgSrc(src);
        let matched = false;
        exampleList.querySelectorAll('.colorizer__example').forEach((card) => {
            const bg = normalizeBgSrc(card.getAttribute('data-bg') || '');
            const isActive = !!target && bg === target;
            if (isActive) matched = true;
            card.classList.toggle('is-active', isActive);
        });
        return matched;
    }

    function updateExamplesScrollState() {
        if (!exampleList) return;
        const count = exampleList.querySelectorAll('.colorizer__example').length;
        exampleList.classList.toggle('is-scrollable', count > 4);
    }

    function renderExamples(examples) {
        if (!exampleList) return;
        if (!Array.isArray(examples) || !examples.length) {
            exampleList.innerHTML = '';
            updateExamplesScrollState();
            return;
        }

        exampleList.innerHTML = '';
        examples.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'colorizer__example';
            card.setAttribute('data-bg', String(item.bg || ''));

            const thumb = document.createElement('span');
            thumb.className = 'colorizer__example-thumb';
            if (item.thumb) {
                thumb.style.backgroundImage = "url('" + String(item.thumb).replace(/'/g, '%27') + "')";
            }

            const title = document.createElement('span');
            title.className = 'colorizer__example-title';
            title.textContent = String(item.title || 'Пример');

            card.appendChild(thumb);
            card.appendChild(title);
            exampleList.appendChild(card);
        });
        setActiveExampleBySrc(bgImg && bgImg.src ? bgImg.src : '');
        updateExamplesScrollState();
    }

    function withoutTextureId() {
        return toText(dynamicData.withoutTextureId, 'without_texture');
    }

    function getTextureBlocks() {
        if (Array.isArray(dynamicData.textureOrder) && dynamicData.textureOrder.length) {
            return dynamicData.textureOrder.slice();
        }
        return getKeys(dynamicData.textures);
    }

    function getCurrentTexture() {
        if (state.block === withoutTextureId()) return null;
        return isObject(dynamicData.textures[state.block]) ? dynamicData.textures[state.block] : null;
    }

    function getCurrentColors() {
        const texture = getCurrentTexture();
        return texture && isObject(texture.colors) ? texture.colors : {};
    }

    function getCurrentFills() {
        const isWithout = state.block === withoutTextureId();
        const fills = isWithout ? dynamicData.fills.withoutTexture : dynamicData.fills.withTexture;
        return isObject(fills) ? fills : {};
    }

    function getCurrentFillNode() {
        const fills = getCurrentFills();
        return fills[state.type] || fills[firstKey(fills)] || null;
    }

    function getCurrentFillMetals() {
        const fillNode = getCurrentFillNode();
        if (!fillNode) return {};

        const explicit = normalizeFillMetals(fillNode.metalColors);
        if (getKeys(explicit).length) return explicit;

        return normalizeFillMetals(dynamicData.defaultFillMetalColors);
    }

    function collectVariantViewKeys(node, outSet) {
        if (!isObject(node)) return;

        if (isObject(node.variants)) {
            getKeys(node.variants).forEach((variantKey) => {
                const variantNode = node.variants[variantKey];
                if (!isObject(variantNode)) return;
                getKeys(variantNode).forEach((key) => {
                    if ((key === 'regular' || key === 'long' || /^long_v\d+$/i.test(key)) && typeof variantNode[key] === 'string' && variantNode[key]) {
                        outSet.add(key);
                    }
                });
            });
            return;
        }

        getKeys(node).forEach((key) => {
            if ((key === 'regular' || key === 'long' || /^long_v\d+$/i.test(key)) && typeof node[key] === 'string' && node[key]) {
                outSet.add(key);
            }
        });
    }

    function getVariantViewSet(node) {
        const out = new Set();
        collectVariantViewKeys(node, out);
        return out;
    }

    function sortViewKeys(keys) {
        const normalized = Array.from(new Set(keys || []));
        const rank = (key) => {
            if (key === 'regular') return 0;
            if (key === 'long') return 1;
            const match = String(key).match(/^long_v(\d+)$/i);
            if (match) return 100 + parseInt(match[1], 10);
            return 1000;
        };
        return normalized.sort((a, b) => {
            const ra = rank(a);
            const rb = rank(b);
            if (ra !== rb) return ra - rb;
            return String(a).localeCompare(String(b));
        });
    }

    function isLongViewKey(view) {
        return /^long(_v\d+)?$/i.test(String(view || ''));
    }

    function getCurrentColorNode() {
        const colors = getCurrentColors();
        return colors[state.metal] || colors[firstKey(colors)] || null;
    }

    function getAvailableViews() {
        const fillViews = getVariantViewSet(getCurrentFillNode());
        const colorViews = getVariantViewSet(getCurrentColorNode());

        let views = [];
        if (fillViews.size && colorViews.size) {
            colorViews.forEach((view) => {
                if (fillViews.has(view)) views.push(view);
            });

            if (!views.length) {
                const fallback = new Set();
                fillViews.forEach((view) => fallback.add(view));
                colorViews.forEach((view) => fallback.add(view));
                views = Array.from(fallback);
            }
        } else if (fillViews.size) {
            views = Array.from(fillViews);
        } else if (colorViews.size) {
            views = Array.from(colorViews);
        }

        const candidates = sortViewKeys(views).filter((view) => allowedViews.indexOf(view) !== -1);
        const initialViews = candidates.length ? candidates : getDefaultViewOrder();
        const uniqueViews = [];
        const seenSignatures = new Set();

        initialViews.forEach((view) => {
            const textureSrc = resolveTextureSrc(view);
            const fillSrc = resolveFillSrc(view);
            const signature = String(textureSrc || '') + '||' + String(fillSrc || '');
            if (seenSignatures.has(signature)) return;
            seenSignatures.add(signature);
            uniqueViews.push(view);
        });

        return uniqueViews.length ? uniqueViews : initialViews;
    }

    function toCaseClassToken(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[_\s]+/g, '-')
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function applyPreviewCaseClasses() {
        if (!previewPane) return;

        const staticClasses = [];
        previewPane.classList.forEach((cls) => {
            if (!cls.startsWith('cz-')) staticClasses.push(cls);
        });

        const dynamicClasses = [];
        const addClass = (cls) => {
            const token = toCaseClassToken(cls);
            if (!token) return;
            dynamicClasses.push('cz-' + token);
        };

        addClass('view-' + state.view);
        if (/^long(_v\d+)?$/i.test(state.view)) {
            addClass('view-long-family');
        }
        addClass(state.block === withoutTextureId() ? 'no-texture' : 'with-texture');
        addClass('texture-' + state.block);
        addClass('fill-' + state.type);

        const fillNode = getCurrentFillNode();
        if (fillNode && typeof fillNode.caseClass === 'string') {
            fillNode.caseClass.split(/\s+/).forEach((part) => addClass(part));
        }

        const textureNode = getCurrentTexture();
        if (textureNode && typeof textureNode.caseClass === 'string') {
            textureNode.caseClass.split(/\s+/).forEach((part) => addClass(part));
        }

        previewPane.className = [...staticClasses, ...dynamicClasses].join(' ');
    }

    function blockLabel(block) {
        if (block === withoutTextureId()) {
            return toText(labels.withoutTexture, 'Без текстур');
        }
        const node = dynamicData.textures[block];
        return toText(node && node.label, titleFromKey(block));
    }

    function typeLabel(type) {
        const fills = getCurrentFills();
        const node = fills[type];
        return toText(node && node.label, titleFromKey(type));
    }

    function metalLabel(metal) {
        const colors = getCurrentColors();
        const node = colors[metal];
        return toText(node && node.label, titleFromKey(metal));
    }

    function metalSwatch(metal) {
        const colors = getCurrentColors();
        const node = colors[metal];
        return colorNodeSwatch(metal, node);
    }

    function fillMetalLabel(fillMetal) {
        const metals = getCurrentFillMetals();
        const node = metals[fillMetal];
        return toText(node && node.label, titleFromKey(fillMetal));
    }

    function fillMetalSwatch(fillMetal) {
        const metals = getCurrentFillMetals();
        const node = metals[fillMetal];
        const swatch = toText(node && node.swatch, guessedColorByKey(fillMetal));
        if (isHexColor(swatch)) {
            return swatch;
        }

        const variants = isObject(node && node.imageVariants) ? node.imageVariants : {};
        const previewTexture = resolveVariantPath(variants, 'regular') || toText(node && node.texture, '');
        if (previewTexture) {
            return {
                backgroundImage: "url('" + previewTexture.replace(/'/g, '%27') + "')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: isHexColor(node.color) ? node.color : guessedColorByKey(fillMetal)
            };
        }

        return guessedColorByKey(fillMetal);
    }

    function blockSwatch(block) {
        if (block === withoutTextureId()) return '';
        const texture = dynamicData.textures[block];
        if (!texture || !isObject(texture.colors)) return '';

        const preferred = selectedMetalByBlock[block] || (state.block === block ? state.metal : '');
        const colorKey = firstExisting(preferred, texture.colors);
        if (!colorKey) return '';
        return colorNodeSwatch(colorKey, texture.colors[colorKey]);
    }

    function viewLabel(view) {
        const views = isObject(labels.views) ? labels.views : {};
        return toText(views[view], titleFromKey(view));
    }

    function getConfiguredViewLabel(view) {
        const views = isObject(labels.views) ? labels.views : {};
        if (typeof views[view] === 'string') {
            const text = views[view].trim();
            return text ? views[view] : '';
        }
        return titleFromKey(view);
    }

    function getVisibleViews() {
        return getAvailableViews().filter((view) => !!getConfiguredViewLabel(view));
    }

    function resolveTextureSrc(requestedView) {
        const selectedView = String(requestedView || state.view || getFallbackView());
        const texture = getCurrentTexture();
        if (!texture) return '';

        const colors = getCurrentColors();
        const colorNode = colors[state.metal] || colors[firstKey(colors)];
        if (!colorNode || !isObject(colorNode)) return '';

        // New simplified format: color has direct regular/long paths.
        if (!isObject(colorNode.variants)) {
            return resolveVariantPath(colorNode, selectedView);
        }

        let bestPath = '';
        let bestScore = -1;
        const variants = colorNode.variants;

        getKeys(variants).forEach((variantKey) => {
            const variantNode = variants[variantKey];
            const resolved = resolveVariantPath(variantNode, selectedView);
            if (!resolved) return;

            let score = 0;
            const hasExplicitView = isObject(variantNode)
                && typeof variantNode[selectedView] === 'string'
                && !!variantNode[selectedView];
            if (hasExplicitView) score += 1;

            const isLongImage = /_long/i.test(resolved);
            const isLongView = /^long(_v\d+)?$/i.test(selectedView);
            if (isLongView && isLongImage) score += 2;
            if (!isLongView && !isLongImage) score += 2;

            if (score > bestScore) {
                bestScore = score;
                bestPath = resolved;
            }
        });

        return bestPath;
    }

    function resolveFillSrc(requestedView) {
        const fillNode = getCurrentFillNode();
        return resolveVariantPath(fillNode, requestedView);
    }

    function resolveFillMetalStyle() {
        const metals = getCurrentFillMetals();
        const selected = metals[state.fillMetal] ? state.fillMetal : firstKey(metals);
        if (!selected) return { color: '', texture: '', sourceOverride: '' };

        const node = metals[selected] || {};
        const variants = isObject(node.imageVariants) ? node.imageVariants : {};
        const fallbackColor = guessedColorByKey(selected);
        const color = isHexColor(node.color)
            ? node.color.trim()
            : (isHexColor(node.swatch) ? node.swatch.trim() : fallbackColor);
        const sourceOverride = resolveVariantPath(variants, state.view);
        const texture = toText(node.texture, '');

        return {
            color: color,
            texture: texture,
            sourceOverride: sourceOverride
        };
    }

    function normalizeState() {
        const textureBlocks = getTextureBlocks();
        blockOrder = [withoutTextureId(), ...textureBlocks];

        if (!state.block || blockOrder.indexOf(state.block) === -1) {
            state.block = textureBlocks[0] || withoutTextureId();
        }

        const colors = getCurrentColors();
        const preferredMetal = selectedMetalByBlock[state.block] || state.metal;
        state.metal = firstExisting(preferredMetal, colors);
        if (!state.metal) state.metal = 'none';
        if (state.block !== withoutTextureId() && state.metal !== 'none') {
            selectedMetalByBlock[state.block] = state.metal;
        }

        const fills = getCurrentFills();
        state.type = firstExisting(state.type, fills);

        const fillMetals = getCurrentFillMetals();
        const preferredFillMetal = selectedFillMetalByType[state.type] || state.fillMetal;
        state.fillMetal = firstExisting(preferredFillMetal, fillMetals);
        if (!state.fillMetal) state.fillMetal = '';
        if (state.type && state.fillMetal) {
            selectedFillMetalByType[state.type] = state.fillMetal;
        }

        const availableViews = getAvailableViews();
        const visibleViews = getVisibleViews();
        const preferredViews = visibleViews.length ? visibleViews : availableViews;
        if (preferredViews.indexOf(state.view) === -1) {
            state.view = preferredViews[0] || getFallbackView();
        }
    }

    function createButton(text, attrs, swatch) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fence-btn';
        Object.entries(attrs).forEach(([k, v]) => btn.setAttribute(k, v));

        if (swatch) {
            const sw = document.createElement('span');
            sw.className = 'fence-swatch';
            if (typeof swatch === 'string') {
                sw.style.background = swatch;
            } else if (isObject(swatch)) {
                if (typeof swatch.background === 'string' && swatch.background.trim()) {
                    sw.style.background = swatch.background;
                }
                if (typeof swatch.backgroundColor === 'string' && swatch.backgroundColor.trim()) {
                    sw.style.backgroundColor = swatch.backgroundColor;
                }
                if (typeof swatch.backgroundImage === 'string' && swatch.backgroundImage.trim()) {
                    sw.style.backgroundImage = swatch.backgroundImage;
                }
                if (typeof swatch.backgroundSize === 'string' && swatch.backgroundSize.trim()) {
                    sw.style.backgroundSize = swatch.backgroundSize;
                }
                if (typeof swatch.backgroundPosition === 'string' && swatch.backgroundPosition.trim()) {
                    sw.style.backgroundPosition = swatch.backgroundPosition;
                }
                if (typeof swatch.backgroundRepeat === 'string' && swatch.backgroundRepeat.trim()) {
                    sw.style.backgroundRepeat = swatch.backgroundRepeat;
                }
            }
            btn.appendChild(sw);
        }

        btn.appendChild(document.createTextNode(text));
        return btn;
    }

    function renderControls() {
        if (blockGroup) {
            blockGroup.innerHTML = '';
            blockOrder.forEach((block) => {
                blockGroup.appendChild(createButton(blockLabel(block), { 'data-block': block }, blockSwatch(block)));
            });
        }

        if (typeGroup) {
            typeGroup.innerHTML = '';
            getKeys(getCurrentFills()).forEach((type) => {
                typeGroup.appendChild(createButton(typeLabel(type), { 'data-type': type }));
            });
        }

        if (metalGroup) {
            metalGroup.innerHTML = '';
            getKeys(getCurrentColors()).forEach((metal) => {
                metalGroup.appendChild(createButton(metalLabel(metal), { 'data-metal': metal }, metalSwatch(metal)));
            });
        }

        if (fillMetalGroup) {
            fillMetalGroup.innerHTML = '';
            getKeys(getCurrentFillMetals()).forEach((fillMetal) => {
                fillMetalGroup.appendChild(createButton(fillMetalLabel(fillMetal), { 'data-fill-metal': fillMetal }, fillMetalSwatch(fillMetal)));
            });
        }

        if (viewGroup) {
            viewGroup.innerHTML = '';
            getVisibleViews().forEach((view) => {
                viewGroup.appendChild(createButton(getConfiguredViewLabel(view), { 'data-view': view }));
            });
        }
    }

    function setNotice(text) {
        if (!overlayNotice) return;
        overlayNotice.hidden = !text;
        overlayNotice.textContent = text || '';
    }

    function setActive(btn, active) {
        btn.classList.toggle('is-active', !!active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    function setDisabled(btn, disabled) {
        btn.disabled = !!disabled;
        btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }

    function loadImageForCanvas(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image: ' + src));
            img.src = String(src || '');
        });
    }

    function hasFillMetalStyle(fillMetalStyle) {
        return !!(
            isHexColor(fillMetalStyle && fillMetalStyle.color)
            || toText(fillMetalStyle && fillMetalStyle.texture, '')
        );
    }

    function buildTintedCanvas(image, textureImage, color) {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (textureImage) {
            const pattern = ctx.createPattern(textureImage, 'repeat');
            if (pattern) {
                ctx.fillStyle = pattern;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else {
                ctx.drawImage(textureImage, 0, 0, canvas.width, canvas.height);
            }
        } else {
            ctx.drawImage(image, 0, 0);
            if (color) {
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }

        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(image, 0, 0);
        return canvas;
    }

    function renderCanvasFillLayer(container, src, fillMetalStyle, altText) {
        if (!container) return Promise.resolve();

        const targetSrc = String(src || '').trim();
        const color = isHexColor(fillMetalStyle && fillMetalStyle.color)
            ? String(fillMetalStyle.color).trim()
            : '';
        const textureSrc = toText(fillMetalStyle && fillMetalStyle.texture, '');

        if (!targetSrc) {
            container.innerHTML = '';
            return Promise.resolve();
        }

        const imageLoads = [loadImageForCanvas(targetSrc)];
        if (textureSrc) {
            imageLoads.push(loadImageForCanvas(textureSrc).catch(() => null));
        } else {
            imageLoads.push(Promise.resolve(null));
        }

        return Promise.all(imageLoads)
            .then(([image, textureImage]) => {
                const canvas = buildTintedCanvas(image, textureImage, color);
                if (!canvas) throw new Error('Failed to create canvas context.');
                canvas.className = 'colorizer__rendered-layer';
                canvas.setAttribute('role', 'img');
                canvas.setAttribute('aria-label', altText);
                container.innerHTML = '';
                container.appendChild(canvas);
            })
            .catch(() => {
                const img = document.createElement('img');
                img.alt = altText;
                container.innerHTML = '';
                container.appendChild(img);
                return setImageSrcWithLoad(img, targetSrc);
            });
    }

    function getTintedFillSrc(src, fillMetalStyle) {
        const targetSrc = String(src || '').trim();
        const color = isHexColor(fillMetalStyle && fillMetalStyle.color)
            ? String(fillMetalStyle.color).trim()
            : '';
        const textureSrc = toText(fillMetalStyle && fillMetalStyle.texture, '');

        if (!targetSrc || (!color && !textureSrc)) {
            return Promise.resolve(targetSrc);
        }

        const cacheKey = targetSrc + '|' + color.toLowerCase() + '|' + textureSrc;
        if (tintedFillCache.has(cacheKey)) {
            return Promise.resolve(tintedFillCache.get(cacheKey));
        }

        const imageLoads = [loadImageForCanvas(targetSrc)];
        if (textureSrc) {
            imageLoads.push(loadImageForCanvas(textureSrc).catch(() => null));
        } else {
            imageLoads.push(Promise.resolve(null));
        }

        return Promise.all(imageLoads)
            .then(([image, textureImage]) => {
                const canvas = buildTintedCanvas(image, textureImage, color);
                if (!canvas) return targetSrc;
                const tintedSrc = canvas.toDataURL('image/png');
                tintedFillCache.set(cacheKey, tintedSrc);
                return tintedSrc;
            })
            .catch(() => targetSrc);
    }

    function renderLayer(container, src, altText, options) {
        if (!container) return Promise.resolve();
        if (!src) {
            container.innerHTML = '';
            return Promise.resolve();
        }

        const fillMetalStyle = isObject(options && options.fillMetalStyle) ? options.fillMetalStyle : { color: '', texture: '', sourceOverride: '' };
        if (isFileProtocol() && hasFillMetalStyle(fillMetalStyle)) {
            return renderCanvasFillLayer(container, src, fillMetalStyle, altText);
        }

        return getTintedFillSrc(src, fillMetalStyle).then((targetSrc) => {
            const img = document.createElement('img');
            img.alt = altText;
            container.innerHTML = '';
            container.appendChild(img);
            return setImageSrcWithLoad(img, targetSrc || src);
        });
    }

    function updateButtons() {
        const hasBlocks = blockOrder.length > 0;
        const fills = getCurrentFills();
        const colors = getCurrentColors();
        const fillMetals = getCurrentFillMetals();
        const hasFills = getKeys(fills).length > 0;
        const hasColors = getKeys(colors).length > 0;
        const hasFillMetals = getKeys(fillMetals).length > 0;

        const availableViews = getAvailableViews();
        const visibleViews = getVisibleViews();
        if (viewSection) viewSection.hidden = !isSectionEnabled('views') || visibleViews.length <= 1;
        if (blockSection) blockSection.hidden = !isSectionEnabled('blocks') || !hasBlocks;
        if (typeSection) typeSection.hidden = !isSectionEnabled('types') || !hasFills;
        if (metalSection) metalSection.hidden = !isSectionEnabled('textureColors') || !hasColors;
        if (fillMetalSection) fillMetalSection.hidden = !isSectionEnabled('metalColors') || !hasFillMetals;

        if (blockGroup) {
            blockGroup.querySelectorAll('[data-block]').forEach((btn) => {
                const block = btn.getAttribute('data-block') || '';
                setDisabled(btn, blockOrder.indexOf(block) === -1);
                setActive(btn, block === state.block);
            });
        }

        if (typeGroup) {
            typeGroup.querySelectorAll('[data-type]').forEach((btn) => {
                const type = btn.getAttribute('data-type') || '';
                const ok = !!fills[type];
                setDisabled(btn, !ok);
                setActive(btn, ok && type === state.type);
            });
        }

        if (metalGroup) {
            metalGroup.querySelectorAll('[data-metal]').forEach((btn) => {
                const metal = btn.getAttribute('data-metal') || '';
                const ok = !!colors[metal];
                setDisabled(btn, !ok);
                setActive(btn, ok && metal === state.metal);
            });
        }

        if (fillMetalGroup) {
            fillMetalGroup.querySelectorAll('[data-fill-metal]').forEach((btn) => {
                const fillMetal = btn.getAttribute('data-fill-metal') || '';
                const ok = !!fillMetals[fillMetal];
                setDisabled(btn, !ok);
                setActive(btn, ok && fillMetal === state.fillMetal);
            });
        }

        if (viewGroup) {
            viewGroup.querySelectorAll('[data-view]').forEach((btn) => {
                const view = btn.getAttribute('data-view') || '';
                const ok = visibleViews.indexOf(view) !== -1;
                setDisabled(btn, !ok);
                setActive(btn, ok && view === state.view);
            });
        }
    }

    function updateOverlayLayers() {
        const textureSrc = resolveTextureSrc();
        const fillSrc = resolveFillSrc();
        const fillMetalStyle = resolveFillMetalStyle();
        const effectiveFillSrc = toText(fillMetalStyle.sourceOverride, fillSrc);
        const requestId = startPreviewLoading();

        const loads = [
            renderLayer(overlayFill, textureSrc, 'Слой текстуры'),
            renderLayer(overlayFront, effectiveFillSrc, 'Слой наполнения', { fillMetalStyle: fillMetalStyle })
        ];

        if (!textureSrc && !effectiveFillSrc) {
            setNotice(notices.noImage || 'Нет изображения для этой комбинации.');
            setPreviewLoading(false, requestId);
            return;
        }
        setNotice('');
        Promise.all(loads).finally(() => {
            setPreviewLoading(false, requestId);
        });
    }

    function refreshUI() {
        normalizeState();
        applySectionLayout();
        applySectionLabels();
        applyDownloadButtonConfig();
        applyPreviewCaseClasses();
        renderControls();
        updateButtons();
        updateOverlayLayers();
        saveStoredState();
    }

    async function loadConfig() {
        const fallbackConfig = clonePlainData(BOOT_CONFIG);

        if (!isFileProtocol()) {
            try {
                const response = await fetch(CONFIG_URL, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error('Config HTTP ' + response.status);
                }
                return response.json();
            } catch (err) {
                if (fallbackConfig) {
                    console.warn('Failed to fetch colorizer config JSON, using embedded fallback instead.', err);
                    return fallbackConfig;
                }
                throw err;
            }
        }

        if (fallbackConfig) {
            return fallbackConfig;
        }

        throw new Error('Embedded config fallback is missing for file:// mode.');
    }

    function applyConfig(config) {
        const behavior = isObject(config && config.behavior) ? config.behavior : {};
        const resolvedSettings = readBootSettings(config);
        swatchMap = buildSwatchMap(config && config.swatches);

        defaultBackground = String(resolvedSettings.defaultBackground || defaultBackground || (bgImg ? (bgImg.getAttribute('src') || '') : ''));
        if (bgImg && defaultBackground) bgImg.src = defaultBackground;

        notices = resolvedSettings.notices;
        labels = resolvedSettings.labels;
        uiSettings = resolvedSettings.uiSettings;
        allowedViews = resolvedSettings.allowedViews;
        defaultView = resolvedSettings.defaultView;
        emptyUploadLabel = resolvedSettings.emptyUploadLabel;
        uploadedPhotoLabel = resolvedSettings.uploadedPhotoLabel;
        swatchFallbackColor = resolvedSettings.swatchFallbackColor;

        if (isObject(config && config.dynamic)) {
            const texturesData = normalizeTextures(config.dynamic.textures);
            dynamicData = {
                withoutTextureId: toText(config.dynamic.withoutTextureId, 'without_texture'),
                textureOrder: texturesData.order,
                textures: texturesData.map,
                defaultFillMetalColors: Array.isArray(config.dynamic.defaultFillMetalColors)
                    ? config.dynamic.defaultFillMetalColors.slice()
                    : [],
                fills: {
                    withTexture: normalizeKeyedCollection(config.dynamic.fills && config.dynamic.fills.withTexture, 'id'),
                    withoutTexture: normalizeKeyedCollection(config.dynamic.fills && config.dynamic.fills.withoutTexture, 'id')
                }
            };
        } else {
            dynamicData = {
                withoutTextureId: 'without_texture',
                textureOrder: [],
                textures: {},
                defaultFillMetalColors: [],
                fills: {
                    withTexture: {},
                    withoutTexture: {}
                }
            };
        }

        if (!dynamicData.textureOrder.length) {
            dynamicData.textureOrder = getKeys(dynamicData.textures).filter((key) => key !== dynamicData.withoutTextureId);
        }

        const defaultState = isObject(behavior.defaultState) ? behavior.defaultState : {};
        state.block = String(defaultState.block || '');
        state.type = String(defaultState.type || '');
        state.metal = String(defaultState.metal || '');
        state.fillMetal = String(defaultState.fillMetal || '');
        state.view = String(defaultState.view || getFallbackView());

        renderExamples((config && config.examples) || []);
    }

    function initExamples() {
        if (!exampleList) return;
        exampleList.addEventListener('click', (e) => {
            const btn = e.target.closest('.colorizer__example');
            if (!btn) return;
            const src = btn.getAttribute('data-bg') || '';
            if (!src || !bgImg) return;
            setBackgroundSrc(src, true);
            setActiveExampleBySrc(src);
            uploadedFileName = '';
            setUploadName(emptyUploadLabel);
            setUploadThumbnail('', false);
            saveStoredState();
        });
    }

    function loadImageFile(file) {
        if (!file || !/^image\//.test(file.type)) return false;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (!bgImg) return;
            setBackgroundSrc(String(ev.target.result || ''), true);
            setActiveExampleBySrc('');
            uploadedFileName = file.name || uploadedPhotoLabel;
            setUploadName(uploadedFileName);
            setUploadThumbnail(bgImg.src, true);
            saveStoredState();
        };
        reader.readAsDataURL(file);
        return true;
    }

    function bindUploadControls() {
        if (!fileInput) return;

        if (pickBtn) {
            pickBtn.addEventListener('click', () => {
                fileInput.click();
            });
        }

        if (dropZone) {
            dropZone.addEventListener('click', () => fileInput.click());
            dropZone.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                fileInput.click();
            });

            ['dragenter', 'dragover'].forEach((eventName) => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.add('is-dragover');
                });
            });

            ['dragleave', 'dragend', 'drop'].forEach((eventName) => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.remove('is-dragover');
                });
            });

            dropZone.addEventListener('drop', (e) => {
                const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                loadImageFile(file);
            });
        }

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            loadImageFile(file);
        });
    }

    function showInfo(title, text) {
        if (window.Swal && typeof window.Swal.fire === 'function') {
            window.Swal.fire({
                title,
                text,
                icon: 'info',
                confirmButtonColor: '#f08519'
            });
            return;
        }
        alert(title + '\n' + text);
    }

    if (blockGroup) {
        blockGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-block]');
            if (!btn || btn.disabled) return;
            state.block = btn.getAttribute('data-block') || '';
            refreshUI();
        });
    }

    if (typeGroup) {
        typeGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-type]');
            if (!btn || btn.disabled) return;
            state.type = btn.getAttribute('data-type') || '';
            refreshUI();
        });
    }

    if (metalGroup) {
        metalGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-metal]');
            if (!btn || btn.disabled) return;
            state.metal = btn.getAttribute('data-metal') || '';
            if (state.block !== withoutTextureId() && state.metal) {
                selectedMetalByBlock[state.block] = state.metal;
            }
            refreshUI();
        });
    }

    if (fillMetalGroup) {
        fillMetalGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-fill-metal]');
            if (!btn || btn.disabled) return;
            state.fillMetal = btn.getAttribute('data-fill-metal') || '';
            if (state.type && state.fillMetal) {
                selectedFillMetalByType[state.type] = state.fillMetal;
            }
            refreshUI();
        });
    }

    if (viewGroup) {
        viewGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-view]');
            if (!btn || btn.disabled) return;
            state.view = btn.getAttribute('data-view') || getFallbackView();
            refreshUI();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (fileInput) fileInput.value = '';
            if (bgImg) setBackgroundSrc(defaultBackground || bgImg.src, true);
            setActiveExampleBySrc(bgImg ? bgImg.src : '');
            uploadedFileName = '';
            setUploadName(emptyUploadLabel);
            setUploadThumbnail('', false);
            saveStoredState();
        });
    }

    if (downloadPreviewBtn) {
        downloadPreviewBtn.addEventListener('click', () => {
            downloadCurrentPreview().catch((err) => {
                console.error('Failed to download preview image:', err);
                showInfo('Ошибка', 'Не удалось скачать изображение.');
            });
        });
    }

    const consultBtn = document.querySelector('.btn-color');
    if (consultBtn) {
        consultBtn.addEventListener('click', () => {
            showInfo('Консультация', 'Оставьте номер телефона, и менеджер свяжется с вами.');
        });
    }

    const callbackBtn = document.querySelector('.footer-callback__btn');
    if (callbackBtn) {
        callbackBtn.addEventListener('click', () => {
            showInfo('Заявка на звонок', 'Мы перезвоним вам в ближайшее время.');
        });
    }

    async function init() {
        setBootState(true);
        initExamples();
        updateExamplesScrollState();
        bindUploadControls();
        try {
            const config = await loadConfig();
            applyConfig(config);
            applyStoredState(loadStoredState());
            refreshUI();

            const currentBg = bgImg && bgImg.src ? bgImg.src : '';
            const currentBgNorm = normalizeBgSrc(currentBg);
            const defaultBgNorm = normalizeBgSrc(defaultBackground);
            const isExampleBg = setActiveExampleBySrc(currentBgNorm);
            const isDefaultBg = !!currentBgNorm && currentBgNorm === defaultBgNorm;
            const isCustomBg = !!currentBgNorm && !isExampleBg && !isDefaultBg;

            if (isCustomBg) {
                setUploadName(uploadedFileName || uploadedPhotoLabel);
                setUploadThumbnail(currentBg, true);
            } else {
                uploadedFileName = '';
                setUploadName(emptyUploadLabel);
                setUploadThumbnail('', false);
                saveStoredState();
            }
        } catch (err) {
            console.error('Failed to load colorizer config:', err);
            setNotice(notices.configLoadFailed || DEFAULT_CONFIG_LOAD_FAILED_NOTICE);
        } finally {
            setBootState(false);
        }
    }

    init();
})();
