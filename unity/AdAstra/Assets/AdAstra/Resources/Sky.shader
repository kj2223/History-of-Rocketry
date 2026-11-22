// A painted sky on a big sphere that follows the camera: a deep top, a pale dusty horizon, and a soft sun.
Shader "AdAstra/Sky"
{
    Properties
    {
        _Top ("Top", Color) = (0.30, 0.52, 0.80, 1)
        _Horizon ("Horizon", Color) = (0.86, 0.84, 0.78, 1)
        _Ground ("Ground", Color) = (0.70, 0.62, 0.50, 1)
        _SunDir ("Sun direction", Vector) = (0.4, 0.6, -0.5, 0)
    }
    SubShader
    {
        Tags { "Queue" = "Background" "RenderType" = "Background" "PreviewType" = "Skybox" }
        Cull Front ZWrite Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            float4 _Top, _Horizon, _Ground, _SunDir;
            struct v2f { float4 pos : SV_POSITION; float3 dir : TEXCOORD0; };
            v2f vert (appdata_base v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.dir = v.vertex.xyz; return o; }
            float4 frag (v2f i) : SV_Target
            {
                float3 d = normalize(i.dir);
                float y = d.y;
                float3 c = y > 0 ? lerp(_Horizon.rgb, _Top.rgb, pow(saturate(y), 0.45)) : lerp(_Horizon.rgb, _Ground.rgb, saturate(-y * 6));
                float s = saturate(dot(d, normalize(_SunDir.xyz)));
                c += pow(s, 300) * 1.5 + pow(s, 12) * 0.12;
                return float4(c, 1);
            }
            ENDCG
        }
    }
}
