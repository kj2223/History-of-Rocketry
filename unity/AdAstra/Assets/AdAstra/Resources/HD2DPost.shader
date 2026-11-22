// The HD-2D light pass over the 3D world, at full resolution (4K stays 4K). It blurs the top and bottom of the picture
// (tilt-shift, so the site reads as a diorama), adds a soft glow from bright things (sun on concrete, flame, lamps),
// and grades it like a 1945 newsreel: faded, warm, fine grain at film speed, a vignette. The pixel people are drawn
// after this, on their own layer, so they stay crisp; the UI goes on last.
Shader "Hidden/AdAstra/HD2DPost"
{
    Properties { _MainTex ("World", 2D) = "white" {} }
    SubShader
    {
        ZTest Always Cull Off ZWrite Off Blend Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            float4 _MainTex_TexelSize;
            float _Focus, _Band, _Blur, _Bloom, _Film, _Fade, _FrameNo;

            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
            v2f vert (appdata_img v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.texcoord; return o; }
            float hash (float2 p) { return frac(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453); }

            float4 frag (v2f i) : SV_Target
            {
                float2 uv = i.uv;
                float2 px = _MainTex_TexelSize.xy * (_MainTex_TexelSize.w / 1080.0); // one 1080p pixel, in uv
                float d = abs(uv.y - _Focus);
                float blur = smoothstep(_Band, _Band + 0.32, d) * _Blur;
                float3 c = 0;
                [unroll] for (int k = 0; k < 24; k++) {
                    float a = k * 2.39996; float r = sqrt((k + 0.5) / 24.0) * blur;
                    c += tex2D(_MainTex, uv + float2(cos(a), sin(a)) * r * px).rgb;
                }
                c /= 24.0;
                float3 g = 0;
                [unroll] for (int k2 = 0; k2 < 24; k2++) {
                    float a = k2 * 2.39996; float r = sqrt((k2 + 0.5) / 24.0) * 22.0;
                    float3 s = tex2D(_MainTex, uv + float2(cos(a), sin(a)) * r * px).rgb;
                    g += max(s - 0.8, 0);
                }
                c += g / 24.0 * _Bloom;
                float lum = dot(c, float3(0.299, 0.587, 0.114));
                float3 film = lerp(c, lum.xxx, 0.2) * float3(1.06, 1.0, 0.88);
                film = (film - 0.5) * 1.04 + 0.5 + 0.01;
                float2 grainCell = floor(uv / (px * 2.0));
                film += (hash(grainCell + _FrameNo * 7.13) - 0.5) * 0.03;
                c = lerp(c, film, _Film);
                float v = smoothstep(1.25, 0.35, length((uv - 0.5) * float2(1.5, 1.0)));
                c *= lerp(0.62, 1.0, v);
                c *= 1 - _Fade;
                return float4(c, 1);
            }
            ENDCG
        }
    }
}
