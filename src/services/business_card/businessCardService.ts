import { Canvas, CanvasRenderingContext2D, loadImage } from "skia-canvas";
import dotenv from "dotenv";

dotenv.config();

export interface ArtisanDataDTO {
    username: string;
    artisan_name: string;
    trade: string;
    location: string;
    tagline?: string;
    contact: string;
    verified_by?: string[];
    headshot_url?: string;
    profile_url?: string;
}

export class IdentityCardService {

    private readonly DPI = 300;

    private readonly MM_TO_PX = this.DPI / 25.4;

    private readonly W = Math.round(85.6 * this.MM_TO_PX);

    private readonly H = Math.round(54 * this.MM_TO_PX);

    private readonly SAFE_ZONE = Math.round(3 * this.MM_TO_PX);

    private readonly FONTS = {
        display: "bold 52px Georgia",
        body: "21px Georgia",
        label: "bold 14px Georgia",
        mono: "italic 17px Georgia"
    };

    private readonly BASE_STYLE =
        'minimal luxury business card background, subtle textures, clean composition, elegant negative space for logo and typography, soft ambient lighting, premium material feel, refined gradients, modern professional branding aesthetic, minimal visual noise, sophisticated simplicity, ultra-clean layout, soft depth, balanced composition, matte and metallic accents, no clutter, no objects, no text, understated elegance';

    private readonly TRADE_ACCENTS: Record<string, string> = {
        carpenter: '#D4891A',
        tailor: '#C084FC',
        mechanic: '#38BDF8',
        plumber: '#34D399',
        electrician: '#FACC15',
        plumbing: '#0EA5E9',
        electrical: '#F59E0B',
        carpentry: '#A16207',
        painting: '#EC4899',
        welding: '#6366F1',
        masonry: '#71717A',
        roofing: '#B45309',
        hvac: '#22D3EE',
        landscaping: '#65A30D',
        cleaning: '#FDF2F8',
        cooking: '#EF4444',
        driving: '#475569',
        security: '#1E293B',
        tailoring: '#DB2777',
        hairdressing: '#F472B6',
        default: '#F97316',
    };

    private readonly THEME_PROMPTS: Record<string, string> = {
        carpenter:
            `${this.BASE_STYLE}, subtle walnut and iroko wood grain texture, soft warm brown gradients, faint handcrafted line details, premium artisan feel`,

        tailor:
            `${this.BASE_STYLE}, soft fabric-inspired texture, muted Ankara geometric accents, elegant gold thread details, refined fashion aesthetic`,

        mechanic:
            `${this.BASE_STYLE}, matte graphite and brushed steel textures, subtle industrial gradients, soft metallic reflections, modern engineering aesthetic`,

        plumber:
            `${this.BASE_STYLE}, clean aqua gradients, faint chrome curves, subtle water-inspired reflections, sleek modern utility aesthetic`,

        electrician:
            `${this.BASE_STYLE}, dark matte background with subtle electric blue glow lines, minimal circuitry-inspired patterns, modern tech elegance`,

        plumbing:
            `${this.BASE_STYLE}, polished chrome textures with soft fluid-inspired gradients, cool blue ambient tones, clean engineering luxury`,

        electrical:
            `${this.BASE_STYLE}, matte black surface with subtle copper line accents, minimal glowing current patterns, refined dark-tech aesthetic`,

        carpentry:
            `${this.BASE_STYLE}, natural timber textures with soft warm lighting, subtle handcrafted depth, minimalist artisan atmosphere`,

        painting:
            `${this.BASE_STYLE}, soft abstract paint gradients, muted artistic brush textures, gallery-inspired luxury minimalism`,

        welding:
            `${this.BASE_STYLE}, dark industrial matte textures, faint metallic glow accents, subtle spark-inspired lighting, cinematic minimalism`,

        masonry:
            `${this.BASE_STYLE}, soft stone and concrete textures, earthy neutral palette, clean architectural depth, timeless craftsmanship feel`,

        roofing:
            `${this.BASE_STYLE}, geometric roofline-inspired patterns, subtle sunset gradients, modern architectural simplicity`,

        hvac:
            `${this.BASE_STYLE}, cool metallic textures, soft airflow-inspired curves, minimal industrial elegance, icy ambient tones`,

        landscaping:
            `${this.BASE_STYLE}, muted organic green gradients, soft leaf-inspired textures, calm eco-luxury atmosphere`,

        cleaning:
            `${this.BASE_STYLE}, bright clean white and silver gradients, soft reflective textures, airy minimalist freshness`,

        cooking:
            `${this.BASE_STYLE}, warm charcoal and copper tones, subtle culinary-inspired textures, refined hospitality aesthetic`,

        driving:
            `${this.BASE_STYLE}, sleek dark gradients with soft motion blur lighting, luxury automotive elegance, premium black finish`,

        security:
            `${this.BASE_STYLE}, matte dark surfaces with subtle shield geometry, minimal encrypted line patterns, executive tech aesthetic`,

        tailoring:
            `${this.BASE_STYLE}, layered textile-inspired textures, soft gold accents, elegant couture minimalism`,

        hairdressing:
            `${this.BASE_STYLE}, smooth flowing curves, glossy beauty-inspired textures, warm premium salon aesthetic`,

        default:
            `${this.BASE_STYLE}, ultra-clean geometric gradients, subtle premium textures, elegant professional simplicity`,
    };

    public async createIdentityCard(
        artisanData: ArtisanDataDTO
    ): Promise<Buffer> {

        const canvas: Canvas = new Canvas(this.W, this.H);

        const ctx: CanvasRenderingContext2D =
            canvas.getContext("2d");

        const tradeKey =
            artisanData.trade.toLowerCase();

        const themePrompt =
            this.THEME_PROMPTS[tradeKey]
            ?? this.THEME_PROMPTS['default'];

        const accentColor =
            this.getTradeAccent(artisanData.trade);

        const pollPrompt = `Premium luxury business card background for a ${
            artisanData.trade
        }, ${themePrompt},
        subtle, elegant, cinematic,
        dark aesthetic,
        minimalist,
        ultra realistic,
        soft lighting,
        no text,
        no watermark`;

        const pollUrl =
            `https://image.pollinations.ai/prompt/${encodeURIComponent(
                pollPrompt
            )}?width=${this.W}&height=${this.H}&nologo=true`;

        try {

            console.log(
                `Requesting Flux Background for: ${artisanData.artisan_name}`
            );

            const response = await fetch(pollUrl);

            if (!response.ok) {
                throw new Error(
                    `Pollinations ${response.status}`
                );
            }

            const background = await loadImage(
                Buffer.from(
                    await response.arrayBuffer()
                )
            );

            ctx.drawImage(
                background,
                0,
                0,
                this.W,
                this.H
            );

            console.log('AI Background Generated.');

        } catch (err) {

            console.error(
                'Background generation failed, using gradient fallback.',
                err
            );

            const gradient =
                ctx.createLinearGradient(
                    0,
                    0,
                    this.W,
                    this.H
                );

            gradient.addColorStop(0, '#0f0f0f');
            gradient.addColorStop(1, '#1a1a2e');

            ctx.fillStyle = gradient;

            ctx.fillRect(
                0,
                0,
                this.W,
                this.H
            );
        }

        ctx.fillStyle = "rgba(8,8,10,0.72)";

        ctx.fillRect(
            0,
            0,
            this.W,
            this.H
        );

        ctx.save();

        ctx.globalAlpha = 0.03;

        for (let i = 0; i < 4000; i++) {

            ctx.fillStyle = "#FFFFFF";

            ctx.fillRect(
                Math.random() * this.W,
                Math.random() * this.H,
                1,
                1
            );
        }

        ctx.restore();

        const ruleX = this.W * 0.38;

        ctx.fillStyle = "rgba(0,0,0,0.28)";

        ctx.fillRect(
            0,
            0,
            ruleX,
            this.H
        );

        ctx.fillStyle = accentColor;

        ctx.fillRect(
            ruleX - 2,
            this.SAFE_ZONE,
            2,
            this.H - this.SAFE_ZONE * 2
        );

        const avatarX = ruleX / 2;
        const avatarY = this.H / 2 - 40;
        const radius = 90;

        ctx.save();

        ctx.beginPath();

        ctx.arc(
            avatarX,
            avatarY,
            radius,
            0,
            Math.PI * 2
        );

        ctx.clip();

        if (artisanData.headshot_url) {

            try {

                const avatar = await loadImage(
                    artisanData.headshot_url
                );

                ctx.drawImage(
                    avatar,
                    avatarX - radius,
                    avatarY - radius,
                    radius * 2,
                    radius * 2
                );

            } catch {

                this.drawInitialsAvatar(
                    ctx,
                    avatarX,
                    avatarY,
                    radius,
                    artisanData.artisan_name,
                    accentColor
                );
            }

        } else {

            this.drawInitialsAvatar(
                ctx,
                avatarX,
                avatarY,
                radius,
                artisanData.artisan_name,
                accentColor
            );
        }

        ctx.restore();

        ctx.arc(
            avatarX,
            avatarY,
            radius + 4,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle = accentColor;

        ctx.lineWidth = 4;

        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.45)";

        ctx.font = this.FONTS.mono;

        ctx.textAlign = "center";

        ctx.fillText(
            `@${artisanData.username}`,
            avatarX,
            avatarY + radius + 35
        );

        const infoX = ruleX + 45;

        ctx.textAlign = "left";

        const nameData = this.drawName(
            ctx,
            artisanData.artisan_name,
            infoX,
            this.W - infoX - this.SAFE_ZONE,
            this.H / 3
        );

        ctx.fillStyle = accentColor;

        ctx.fillRect(
            infoX,
            nameData.endY + 10,
            70,
            4
        );

        const badgeY =
            nameData.endY + 45;

        ctx.font = this.FONTS.label;

        const badgeText =
            artisanData.trade.toUpperCase();

        const badgeWidth =
            ctx.measureText(
                badgeText
            ).width + 30;

        ctx.fillStyle = accentColor;

        this.roundRect(
            ctx,
            infoX,
            badgeY,
            badgeWidth,
            34,
            17
        );

        ctx.fill();

        ctx.fillStyle = "#000";

        ctx.fillText(
            badgeText,
            infoX + 15,
            badgeY + 22
        );

        const detailStartY =
            badgeY + 80;

        ctx.font = this.FONTS.body;

        const details = [
            {
                icon: "⌖",
                text: artisanData.location
            },
            {
                icon: "✆",
                text: artisanData.contact
            }
        ];

        details.forEach((item, index) => {

            const y =
                detailStartY + index * 38;

            ctx.fillStyle = accentColor;

            ctx.fillText(
                item.icon,
                infoX,
                y
            );

            ctx.fillStyle =
                "rgba(255,255,255,0.9)";

            ctx.fillText(
                item.text,
                infoX + 30,
                y
            );
        });

        ctx.fillStyle = accentColor;

        ctx.globalAlpha = 0.2;

        ctx.fillRect(
            ruleX,
            this.H - 8,
            this.W - ruleX,
            8
        );

        ctx.globalAlpha = 1;

        ctx.fillRect(
            ruleX,
            this.H - 8,
            (this.W - ruleX) * 0.3,
            8
        );

        return canvas.toBuffer("png");
    }

    private getTradeAccent(
        trade: string
    ): string {

        return (
            this.TRADE_ACCENTS[
                trade.toLowerCase()
            ] ?? this.TRADE_ACCENTS['default']
        );
    }

    private roundRect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number
    ): void {

        ctx.beginPath();

        ctx.moveTo(x + r, y);

        ctx.lineTo(x + w - r, y);

        ctx.quadraticCurveTo(
            x + w,
            y,
            x + w,
            y + r
        );

        ctx.lineTo(
            x + w,
            y + h - r
        );

        ctx.quadraticCurveTo(
            x + w,
            y + h,
            x + w - r,
            y + h
        );

        ctx.lineTo(
            x + r,
            y + h
        );

        ctx.quadraticCurveTo(
            x,
            y + h,
            x,
            y + h - r
        );

        ctx.lineTo(
            x,
            y + r
        );

        ctx.quadraticCurveTo(
            x,
            y,
            x + r,
            y
        );

        ctx.closePath();
    }

    private drawInitialsAvatar(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        radius: number,
        name: string,
        accent: string
    ): void {

        ctx.fillStyle =
            accent + '33';

        ctx.fillRect(
            cx - radius,
            cy - radius,
            radius * 2,
            radius * 2
        );

        const initials = name
            .split(' ')
            .slice(0, 2)
            .map(
                w => w[0]?.toUpperCase() ?? ''
            )
            .join('');

        ctx.fillStyle = '#FFFFFF';

        ctx.font =
            `bold ${radius * 0.75}px Georgia`;

        ctx.textAlign = 'center';

        ctx.textBaseline = 'middle';

        ctx.fillText(
            initials,
            cx,
            cy
        );

        ctx.textBaseline = 'alphabetic';
    }

    private drawName(
        ctx: CanvasRenderingContext2D,
        name: string,
        x: number,
        maxW: number,
        startY: number
    ) {

        let fontSize = 52;

        ctx.font =
            `bold ${fontSize}px Georgia`;

        while (
            ctx.measureText(name).width > maxW
            && fontSize > 32
        ) {

            fontSize -= 2;

            ctx.font =
                `bold ${fontSize}px Georgia`;
        }

        const words =
            name.split(" ");

        const lines: string[] = [];

        let currentLine = "";

        for (const word of words) {

            const testLine =
                currentLine
                    ? `${currentLine} ${word}`
                    : word;

            if (
                ctx.measureText(testLine).width > maxW
            ) {

                lines.push(currentLine);

                currentLine = word;

            } else {

                currentLine = testLine;
            }
        }

        lines.push(currentLine);

        const lineHeight =
            fontSize * 1.1;

        ctx.fillStyle = "#FFFFFF";

        lines.forEach((line, i) => {

            ctx.fillText(
                line,
                x,
                startY + i * lineHeight
            );
        });

        return {
            endY:
                startY + lines.length * lineHeight
        };
    }
}

export const identityCardService = new IdentityCardService()