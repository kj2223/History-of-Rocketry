"""Persistent, code-drawn 1969 observation displays driven by the public mission model."""
import math
import tkinter as tk
from tkinter import ttk
from .trajectory import trajectory

LANDS=[
 [(-168,68),(-150,72),(-130,62),(-125,49),(-123,34),(-110,24),(-98,16),(-84,10),(-81,24),(-65,46),(-58,53),(-80,62),(-105,72)],
 [(-81,12),(-72,8),(-49,-2),(-35,-8),(-46,-25),(-65,-55),(-74,-45),(-76,-16)],
 [(-52,60),(-25,70),(-41,82),(-58,79)],
 [(-17,36),(1,37),(14,32),(34,30),(43,12),(39,-7),(32,-29),(18,-35),(10,-11),(-1,6),(-16,16)],
 [(-10,36),(-10,58),(20,71),(65,74),(100,77),(155,62),(178,52),(145,35),(121,20),(106,8),(99,20),(77,9),(55,25),(37,31),(24,41)],
 [(113,-12),(137,-10),(153,-24),(146,-39),(128,-34),(115,-23)],
 [(-180,-72),(-120,-69),(-60,-74),(0,-71),(60,-69),(120,-74),(180,-72)]
]


class ControlRoomDisplay(ttk.Frame):
    def __init__(self,parent,location):
        super().__init__(parent)
        self.location=location
        self.canvas=tk.Canvas(self,height=250,highlightthickness=0,bg='#313a3a')
        self.canvas.pack(fill='both',expand=True)
        self.items={}
        self.width=0
        self.latest=None
        self.canvas.bind('<Configure>',self.resize)
        self.height=250

    def resize(self,event):
        if event.width!=self.width or event.height!=self.height:
            self.width=event.width
            self.height=event.height
            self.build()
            if self.latest:self.update_display(*self.latest)

    def geometry(self):
        scale=min(max(1,self.width)/900,max(1,self.height)/300)
        return scale,(self.width-900*scale)/2,(self.height-300*scale)/2

    def point(self,x,y):
        scale,left,top=self.geometry()
        return left+x*scale,top+y*scale
    def coords(self,item,*values):
        coords=[]
        for index in range(0,len(values),2):coords.extend(self.point(values[index],values[index+1]))
        self.canvas.coords(item,*coords)

    def build(self):
        c=self.canvas;c.delete('all');self.items={}
        scale,left,top=self.geometry()
        def rect(x1,y1,x2,y2,**kw):return c.create_rectangle(*self.point(x1,y1),*self.point(x2,y2),**kw)
        def line(*points,**kw):
            transformed=[]
            for index in range(0,len(points),2):transformed.extend(self.point(points[index],points[index+1]))
            return c.create_line(*transformed,**kw)
        def text(x,y,value,**kw):return c.create_text(*self.point(x,y),text=value,font=('Consolas',max(8,int(11*scale))),**kw)
        trim='#617477' if self.location=='lcc' else '#7c735d'
        rect(0,0,900,300,fill=trim,outline='')
        rect(8,6,892,33,fill='#101719',outline='#a2a08c')
        self.items['clock']=text(22,19,'MISSION CLOCK',fill='#ffbf65',anchor='w')
        text(880,19,'LCC / FIRING ROOM' if self.location=='lcc' else 'MCC / FLIGHT DYNAMICS',fill='#ded8bc',anchor='e')
        rect(10,40,573,280,fill='#0b181d',outline='#b8b3a1',width=3)
        rect(584,40,890,280,fill='#071312',outline='#b8b3a1',width=3)
        self.items['screen_label']=text(25,53,'SIMULATED CAMERA' if self.location=='lcc' else 'GROUND TRACK / MODEL ESTIMATE',fill='#a6d8ca',anchor='w')
        if self.location=='lcc':
            for band in range(24):
                colour=f'#{45+band*2:02x}{74+band*2:02x}{91+band*2:02x}'
                rect(17,65+band*8,566,74+band*8,fill=colour,outline='')
            ground_start=set(c.find_all())
            rect(17,254,566,273,fill='#596758',outline='')
            for x in (30,105,460,510):line(x,252,x+13,240,x+26,252,fill='#3a4d43',width=3)
            self.items['ground_parts']=list(set(c.find_all())-ground_start)
            tower_start=set(c.find_all())
            self.items['tower']=rect(202,132,222,254,fill='#8b8275',outline='#c4beb1')
            for y in range(143,250,18):line(202,y,222,y+12,fill='#443d38')
            line(193,133,193,256,fill='#918b7b',width=4)
            self.items['tower_parts']=list(set(c.find_all())-tower_start)
            self.items['smoke']=[c.create_oval(0,0,1,1,fill='#b8bab1',outline='') for _ in range(12)]
            self.items['flame']=c.create_polygon(0,0,1,1,fill='#f29b37',outline='')
            self.items['core']=c.create_polygon(0,0,1,1,fill='#fff4bc',outline='')
            self.items['rocket']=c.create_polygon(0,0,1,1,fill='#edece0',outline='#303c3c',width=1)
            self.items['bands']=[c.create_polygon(0,0,1,1,fill='#212c2d',outline='') for _ in range(4)]
            self.items['stage_drop']=c.create_polygon(0,0,1,1,fill='#b6b8af',outline='#343e3d')
            self.items['rocket_label']=text(0,0,'USA',fill='#334140')
            self.items['camera_note']=text(28,77,'CAM 01 / PAD',fill='#f4f0d8',anchor='w')
            self.items['orbit_horizon']=c.create_polygon(0,0,1,1,fill='#456e88',outline='#bdd8dc',width=3,state='hidden')
            self.items['orbit_title']=text(290,137,'PARKING ORBIT',fill='#fff0c5',state='hidden')
            self.items['orbit_detail']=text(290,164,'Spacecraft checkout follows',fill='#e9efe4',state='hidden')
        else:
            for lon in range(-180,181,30):
                x=22+(lon+180)*540/360
                line(x,72,x,254,fill='#18393b')
            for lat in range(-60,61,30):
                y=72+(90-lat)*182/180
                line(22,y,562,y,fill='#18393b')
            for polygon in LANDS:
                points=[]
                for lon,lat in polygon:points.extend((22+(lon+180)*540/360,72+(90-lat)*182/180))
                coords=[]
                for index in range(0,len(points),2):coords.extend(self.point(points[index],points[index+1]))
                c.create_polygon(*coords,fill='#254c4d',outline='#508184')
            self.items['trail']=[c.create_line(0,0,1,1,fill='#91dfd2',width=2) for _ in range(120)]
            self.items['marker']=c.create_oval(0,0,1,1,fill='#ffd18b',outline='#fff0b4')
            self.items['map_note']=text(27,264,'Nominal trajectory / not tracked orbital elements',fill='#b6c3ae',anchor='w')
        for index,(key,label) in enumerate((('altitude','ALT km'),('velocity','VEL km/s'),('range','RANGE km'),('q','Q kPa'),('stage','VEHICLE'),('status','STATUS'))):
            y=64+index*25
            text(598,y,label,fill='#88b9aa',anchor='w')
            self.items[key]=text(875,y,'—',fill='#e2ead3',anchor='e')
        text(600,224,'NOMINAL MODEL ESTIMATES',fill='#c9ad74',anchor='w')
        self.items['graph']=c.create_line(0,0,1,1,fill='#e0cc8c',width=2)
        line(600,263,875,263,fill='#476355')
        text(600,271,'ALTITUDE / LAST 10 MIN',fill='#829d8e',anchor='w')
        for x in range(20,890,35):
            rect(x,287,x+24,295,fill='#39484a',outline='#92998a')
            rect(x+2,289,x+7,292,fill='#dfae61',outline='')

    def update_display(self,public,report,fraction=0):
        self.latest=(public,report,fraction)
        if not self.items:return
        flight=report['flight'];sample=flight.get('launch') if flight else None
        c=self.canvas
        if not sample:
            label='LEGACY HOURLY FLIGHT / SECOND-CLOCK DISPLAY UNAVAILABLE' if flight else 'MISSION COMPLETE / LAST RECEIVED DISPLAY' if report['result'] else 'PREPARATION / AWAITING AUTHORISATION'
            c.itemconfigure(self.items['clock'],text=label)
            if not report['result']:
                for key in ('altitude','velocity','range','q','stage','status'):
                    c.itemconfigure(self.items[key],text='—')
            return
        t=sample['met_seconds']
        sign='−' if t<0 else '+'
        n=abs(int(t));h,rest=divmod(n,3600);m,s=divmod(rest,60)
        c.itemconfigure(self.items['clock'],text=f'T{sign}{h:03}:{m:02}:{s:02}   MISSION ELAPSED TIME')
        values={
            'altitude':'—' if sample['altitude_km'] is None else f"{sample['altitude_km']:8.2f}",
            'velocity':'—' if sample['speed_km_s'] is None else f"{sample['speed_km_s']:8.3f}",
            'range':'—' if sample['range_km'] is None else f"{sample['range_km']:9.1f}",
            'q':'—' if sample.get('q_kpa') is None else f"{sample['q_kpa']:8.2f}",
            'stage':sample['stage'],'status':'CONTINGENCY' if flight['operations']=='Return contingency active' else 'NOMINAL PROFILE'}
        for key,value in values.items():c.itemconfigure(self.items[key],text=value)
        trace=flight['telemetry_trace']
        heights=[item for item in trace if item['altitude_km'] is not None]
        c.itemconfigure(self.items['graph'],state='normal' if len(heights)>1 else 'hidden')
        if len(heights)>1:
            start=heights[0]['second'];span=max(1,heights[-1]['second']-start)
            points=[]
            for item in heights:points.extend((600+275*(item['second']-start)/span,254-18*min(1,item['altitude_km']/200)))
            self.coords(self.items['graph'],*points)
        if self.location=='lcc':
            visual=trajectory(flight['mission_seconds']+fraction*3600,flight['phase'])
            visual['_phase']=flight['phase']
            visual['_contingency']=flight['operations']=='Return contingency active'
            if visual['_contingency']:visual.update(powered=False)
            self.draw_camera(visual)
        else:self.draw_map(sample,trace)

    def draw_camera(self,sample):
        c=self.canvas;t=sample['met_seconds']
        contingency=sample.get('_contingency',False)
        end=t>709 or sample['altitude_km'] is None or contingency
        c.itemconfigure(self.items['camera_note'],text='LAUNCH COMPLETE / FLIGHT CONTROL HAS THE SPACECRAFT' if end else 'CAM 01 / PAD' if t<15 else 'CAM 02 / OPTICAL TRACKING')
        if end:
            c.itemconfigure(self.items['orbit_title'],text='CONTINGENCY IN EFFECT' if contingency else 'PARKING ORBIT' if sample.get('_phase')=='Ascent' else 'LAUNCH RECORD')
            c.itemconfigure(self.items['orbit_detail'],text='Follow Flight Control reports' if contingency else 'Spacecraft checkout follows' if sample.get('_phase')=='Ascent' else 'Follow the mission in MCC')
            if contingency:c.itemconfigure(self.items['camera_note'],text='FLIGHT CONTROL / CONTINGENCY REPORT')
        for key in ('orbit_horizon','orbit_title','orbit_detail'):
            c.itemconfigure(self.items[key],state='normal' if end else 'hidden')
        if contingency:c.itemconfigure(self.items['orbit_horizon'],state='hidden')
        horizon=[17,273]
        for x in range(17,567,10):horizon.extend((x,min(273,220+65*((x-290)/270)**2)))
        horizon.extend((566,273))
        self.coords(self.items['orbit_horizon'],*horizon)
        pitch=math.radians(min(70,max(0,t)*70/709))
        height=112 if t<162 else 83 if t<549 else 56
        width=12 if t<162 else 10
        base_x=255 if t<15 else 290
        base_y=253-min(105,max(0,sample['altitude_km'] or 0)*.65*100) if t<15 else 185
        if end:base_x,base_y=-100,-100
        def transform(points):
            output=[]
            for x,y in points:
                output.extend((base_x+x*math.cos(pitch)-y*math.sin(pitch),base_y+x*math.sin(pitch)+y*math.cos(pitch)))
            return output
        self.coords(self.items['rocket'],*transform([(-width/2,0),(-width/2,-height+18),(0,-height),(width/2,-height+18),(width/2,0)]))
        for index,item in enumerate(self.items['bands']):
            y=-height*(.22+.18*index)
            self.coords(item,*transform([(-width/2,y),(-width/2,y-7),(width/2,y-7),(width/2,y)]))
        flame=sample['powered'] and not end
        length=24+5*math.sin(t*4) if flame else 0
        self.coords(self.items['flame'],*transform([(-5,0),(0,length),(5,0)]))
        self.coords(self.items['core'],*transform([(-3,0),(0,length*.66),(3,0)]))
        label=transform([(0,-height*.45)])
        self.coords(self.items['rocket_label'],*label)
        c.itemconfigure(self.items['rocket_label'],angle=90-math.degrees(pitch))
        for index,item in enumerate(self.items['smoke']):
            visible=-8<=t<40
            c.itemconfigure(item,state='normal' if visible else 'hidden')
            size=max(0,20+index*2+t*1.5) if visible else 0
            x=255+(index-6)*(8+max(0,t)*.8)
            y=253+index%3*3
            self.coords(item,x-size,y-size*.2,x+size,y+size*.3)
        separation=162<=t<193 or 549<=t<580
        delta=t-(162 if t<549 else 549)
        if separation and not end:
            x,y=base_x-25-delta,base_y+delta*2
            self.coords(self.items['stage_drop'],x-7,y-15,x+7,y-15,x+7,y+20,x-7,y+20)
        else:self.coords(self.items['stage_drop'],-50,-50,-40,-50,-40,-40)
        for item in self.items['ground_parts']:
            c.itemconfigure(item,state='normal' if t<15 else 'hidden')
        for item in self.items['tower_parts']:
            c.itemconfigure(item,state='normal' if t<15 else 'hidden')

    def draw_map(self,sample,trace):
        def position(item):return 22+(item['longitude']+180)*540/360,72+(90-item['latitude'])*182/180
        points=[item for item in trace if item['longitude'] is not None]
        for index,line in enumerate(self.items['trail']):
            if index+1<len(points) and abs(points[index+1]['longitude']-points[index]['longitude'])<180:
                self.coords(line,*position(points[index]),*position(points[index+1]))
            else:self.coords(line,-10,-10,-9,-9)
        if sample['longitude'] is not None:
            x,y=position(sample);self.coords(self.items['marker'],x-4,y-4,x+4,y+4)
        else:self.coords(self.items['marker'],-10,-10,-9,-9)
        self.canvas.itemconfigure(self.items['map_note'],text='Trajectory unavailable in this phase; see sampled instrument reports' if sample['longitude'] is None else 'Nominal ascent / circular parking-orbit estimate')
