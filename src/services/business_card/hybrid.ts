import { Canvas, CanvasRenderingContext2D, loadImage } from "skia-canvas";
import dotenv from "dotenv";

dotenv.config();

interface ArtisanDataDTO {
    username: string;
    artisan_name: string;
    trade: string;
    location: string;
    tagline?: string;
    contact: string;
    verified_by?: string[];
    headshot_url?: string;
}

// Per-trade accent colours — gives each card its own identity
const TRADE_ACCENTS: Record<string, string> = {
    carpenter:    '#D4891A', // warm amber
    tailor:       '#C084FC', // soft violet
    mechanic:     '#38BDF8', // steel blue
    plumber:      '#34D399', // teal-green
    electrician:  '#FACC15', // electric yellow
    plumbing:     '#0EA5E9', // water blue
    electrical:   '#F59E0B', // amber spark
    carpentry:    '#A16207', // deep wood
    painting:     '#EC4899', // vibrant pink
    welding:      '#6366F1', // indigo arc
    masonry:      '#71717A', // stone gray
    roofing:      '#B45309', // terracotta
    hvac:         '#22D3EE', // cool cyan
    landscaping:  '#65A30D', // leaf green
    cleaning:     '#FDF2F8', // crystal white
    cooking:      '#EF4444', // chef red
    driving:      '#475569', // asphalt slate
    security:     '#1E293B', // midnight navy
    tailoring:    '#DB2777', // fashion magenta
    hairdressing: '#F472B6', // salon pink
    default:      '#F97316', // burnt orange
};

function getTradeAccent(trade: string): string {
    return TRADE_ACCENTS[trade.toLowerCase()] ?? TRADE_ACCENTS['default'];
}

// Rounded rect helper (Canvas 2D has no built-in roundRect in older skia-canvas)
function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    w: number, h: number,
    r: number
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// Draws initials inside the avatar circle as a graceful fallback
function drawInitialsAvatar(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    radius: number,
    name: string,
    accent: string
) {
    ctx.fillStyle = accent + '33'; // 20% opacity fill
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    const initials = name
        .split(' ')
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() ?? '')
        .join('');

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${radius * 0.75}px Georgia`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, cx, cy);
    ctx.textBaseline = 'alphabetic'; // reset
}

const BASE_STYLE =
  'minimal luxury business card background, subtle textures, clean composition, elegant negative space for logo and typography, soft ambient lighting, premium material feel, refined gradients, modern professional branding aesthetic, minimal visual noise, sophisticated simplicity, ultra-clean layout, soft depth, balanced composition, matte and metallic accents, no clutter, no objects, no text, understated elegance';

const THEME_PROMPTS: Record<string, string> = {
  carpenter:
    `${BASE_STYLE}, subtle walnut and iroko wood grain texture, soft warm brown gradients, faint handcrafted line details, premium artisan feel`,

  tailor:
    `${BASE_STYLE}, soft fabric-inspired texture, muted Ankara geometric accents, elegant gold thread details, refined fashion aesthetic`,

  mechanic:
    `${BASE_STYLE}, matte graphite and brushed steel textures, subtle industrial gradients, soft metallic reflections, modern engineering aesthetic`,

  plumber:
    `${BASE_STYLE}, clean aqua gradients, faint chrome curves, subtle water-inspired reflections, sleek modern utility aesthetic`,

  electrician:
    `${BASE_STYLE}, dark matte background with subtle electric blue glow lines, minimal circuitry-inspired patterns, modern tech elegance`,

  plumbing:
    `${BASE_STYLE}, polished chrome textures with soft fluid-inspired gradients, cool blue ambient tones, clean engineering luxury`,

  electrical:
    `${BASE_STYLE}, matte black surface with subtle copper line accents, minimal glowing current patterns, refined dark-tech aesthetic`,

  carpentry:
    `${BASE_STYLE}, natural timber textures with soft warm lighting, subtle handcrafted depth, minimalist artisan atmosphere`,

  painting:
    `${BASE_STYLE}, soft abstract paint gradients, muted artistic brush textures, gallery-inspired luxury minimalism`,

  welding:
    `${BASE_STYLE}, dark industrial matte textures, faint metallic glow accents, subtle spark-inspired lighting, cinematic minimalism`,

  masonry:
    `${BASE_STYLE}, soft stone and concrete textures, earthy neutral palette, clean architectural depth, timeless craftsmanship feel`,

  roofing:
    `${BASE_STYLE}, geometric roofline-inspired patterns, subtle sunset gradients, modern architectural simplicity`,

  hvac:
    `${BASE_STYLE}, cool metallic textures, soft airflow-inspired curves, minimal industrial elegance, icy ambient tones`,

  landscaping:
    `${BASE_STYLE}, muted organic green gradients, soft leaf-inspired textures, calm eco-luxury atmosphere`,

  cleaning:
    `${BASE_STYLE}, bright clean white and silver gradients, soft reflective textures, airy minimalist freshness`,

  cooking:
    `${BASE_STYLE}, warm charcoal and copper tones, subtle culinary-inspired textures, refined hospitality aesthetic`,

  driving:
    `${BASE_STYLE}, sleek dark gradients with soft motion blur lighting, luxury automotive elegance, premium black finish`,

  security:
    `${BASE_STYLE}, matte dark surfaces with subtle shield geometry, minimal encrypted line patterns, executive tech aesthetic`,

  tailoring:
    `${BASE_STYLE}, layered textile-inspired textures, soft gold accents, elegant couture minimalism`,

  hairdressing:
    `${BASE_STYLE}, smooth flowing curves, glossy beauty-inspired textures, warm premium salon aesthetic`,

  default:
    `${BASE_STYLE}, ultra-clean geometric gradients, subtle premium textures, elegant professional simplicity`,
};




export const createIdentityCard = async (artisanData: ArtisanDataDTO) => {


    const width: number = 1011;
    const height: number = 638;
    const canvas: Canvas = new Canvas(width, height);

    const ctx: CanvasRenderingContext2D = canvas.getContext("2d");

    const tradeKey    = artisanData.trade.toLowerCase();
    const themePrompt = THEME_PROMPTS[tradeKey] ?? THEME_PROMPTS['default'];
    const accentColor = getTradeAccent(artisanData.trade);

    const pollPrompt = `Premium background for a ${artisanData.trade} digital ID card, ${themePrompt}, high-end professional aesthetic, 8k, minimalist`;
    const pollUrl    = `https://image.pollinations.ai/prompt/${encodeURIComponent(pollPrompt)}?width=${width}&height=${height}&nologo=true`;

    try {
        console.log(`Requesting Flux Background for: ${artisanData.artisan_name}`);
        const response = await fetch(pollUrl);
        if (!response.ok) throw new Error(`Pollinations ${response.status}`);
        const background = await loadImage(Buffer.from(await response.arrayBuffer()));
        ctx.drawImage(background, 0, 0, width, height);
        console.log('AI Background Generated.');

    } catch (err) {
        console.error('Background generation failed, using gradient fallback.', err);
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#0f0f0f');
        gradient.addColorStop(1, '#1a1a2e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.fillRect(0, 0, width, height);

    // ── LEFT PANEL: frosted identity strip ─────────────────────────────────
    const panelW = 295;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, panelW, height);

    // Accent edge line
    ctx.fillStyle = accentColor;
    ctx.fillRect(panelW - 4, 0, 4, height);

    // ── HEADSHOT ───────────────────────────────────────────────────────────
    const avatarX = panelW / 2;
    const avatarY = height / 2 - 28;
    const radius  = 88;

    // Glowing ring
    ctx.save();
    ctx.shadowColor = accentColor;
    ctx.shadowBlur  = 28;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, radius + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Clip circle for avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();


    if (artisanData.headshot_url) {
        try {
            const headshot = await loadImage(artisanData.headshot_url);
            ctx.drawImage(headshot, avatarX - radius, avatarY - radius, radius * 2, radius * 2);
        } catch {
            drawInitialsAvatar(ctx, avatarX, avatarY, radius, artisanData.artisan_name, accentColor);
        }
    } else {
        drawInitialsAvatar(ctx, avatarX, avatarY, radius, artisanData.artisan_name, accentColor);
    }
    ctx.restore();

    // Username below avatar
    ctx.fillStyle   = 'rgba(255, 255, 255, 0.42)';
    ctx.font        = 'italic 17px Georgia';
    ctx.textAlign   = 'center';
    ctx.fillText(`@${artisanData.username}`, avatarX, avatarY + radius + 30);

    // Trade pill badge
    const tradeLabel = artisanData.trade.toUpperCase();
    const pillW = 164;
    const pillH = 34;
    const pillX = avatarX - pillW / 2;
    const pillY = height - 68;

    ctx.fillStyle = accentColor;
    roundRect(ctx, pillX, pillY, pillW, pillH, 17);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.font      = 'bold 14px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(tradeLabel, avatarX, pillY + 23);

    // ── RIGHT INFO PANEL ───────────────────────────────────────────────────
    const infoX = panelW + 52;
    const nameY  = 168;

    // Top rule
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(infoX, 84);
    ctx.lineTo(width - 44, 84);
    ctx.stroke();

    // Name — large serif
    ctx.fillStyle   = '#FFFFFF';
    ctx.textAlign   = 'left';
    ctx.font        = 'bold 50px Georgia';
    ctx.fillText(artisanData.artisan_name, infoX, nameY);

    // Accent underline beneath name
    const nameW = ctx.measureText(artisanData.artisan_name).width;
    ctx.fillStyle = accentColor;
    ctx.fillRect(infoX, nameY + 10, Math.min(nameW, width - infoX - 44), 3);

    // Tagline — italic
    if (artisanData.tagline) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.font      = 'italic 21px Georgia';
        ctx.fillText(`"${artisanData.tagline}"`, infoX, nameY + 54);
    }

    // Section divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(infoX, nameY + 86);
    ctx.lineTo(width - 44, nameY + 86);
    ctx.stroke();

    // Location + Contact with accent icon glyphs
    const detailY = nameY + 134;
    ctx.font = '21px Georgia';

    ctx.fillStyle = accentColor;
    ctx.fillText('⌖', infoX, detailY);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillText(artisanData.location, infoX + 32, detailY);

    ctx.fillStyle = accentColor;
    ctx.fillText('✆', infoX, detailY + 42);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillText(artisanData.contact, infoX + 32, detailY + 42);

    // ── VERIFICATION STAMP (bottom-right) ──────────────────────────────────
    if (artisanData.verified_by && artisanData.verified_by.length > 0) {
        const stampX = width - 44;
        const stampY = height - 44;

        ctx.textAlign = 'right';
        ctx.font      = '600 12px Georgia';
        ctx.fillStyle = accentColor;
        ctx.fillText('✦  VERIFIED BY', stampX, stampY - 24);

        ctx.font      = 'bold 17px Georgia';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(artisanData.verified_by.join('  ·  '), stampX, stampY);
    }

    // Bottom accent bar (right panel only)
    ctx.fillStyle = accentColor;
    ctx.fillRect(panelW + 4, height - 6, width - panelW - 4, 6);

    return canvas.toBuffer('png');

}