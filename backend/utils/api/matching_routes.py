from flask import request, jsonify, g
from ..matching import MatchingService, ProfileService
from ..database.dataBase import DatabaseManager
import datetime
import logging
from ..fhe.fhe import *
import random
from ..useful.gen_rand_message import generate_random_message_string,generate_random_hex_string
from ..ecc_elgamal import *
from ..ecc.sm2 import *
import json 

class MatchingRoutes:
    """匹配系统相关的路由处理类"""
    
    def __init__(self, app, db_path: str, require_session_decorator):
        self.app = app
        self.db_path = db_path
        self.require_session = require_session_decorator
        self._register_routes()
    
    def _get_db_manager(self):
        """获取数据库管理器实例"""
        if 'db' not in g:
            g.db = DatabaseManager(self.db_path)
            g.db.connect()
        return g.db
    
    def _register_routes(self):
        """注册所有匹配系统相关的路由"""
        
        @self.app.route('/api/user_info', methods=['GET'])
        @self.require_session
        def get_user_info():
            """获取用户信息 - 需要有效的session"""
            username = g.current_user
            db = self._get_db_manager()
            profile_service = ProfileService(db)
            result = profile_service.get_user_profile(username)
            
            if result['success']:
                return jsonify(result['profile'])
            else:
                return jsonify({'error': result['error']}), 404
        
        @self.app.route('/api/update_profile', methods=['POST'])
        @self.require_session
        def update_profile():
            """更新用户资料 - 需要有效的session"""
            username = g.current_user
            data = request.get_json()
            
            db = self._get_db_manager()
            profile_service = ProfileService(db)
            result = profile_service.update_user_profile(username, data)
            
            if result['success']:
                return jsonify(result)
            else:
                status_code = 404 if 'not found' in result['error'] else 400
                return jsonify(result), status_code
        
        @self.app.route('/api/profile_status', methods=['GET'])
        @self.require_session
        def get_profile_status():
            """获取用户资料完整性状态"""
            username = g.current_user
            db = self._get_db_manager()
            profile_service = ProfileService(db)
            result = profile_service.get_profile_status(username)
            
            if result['success']:
                return jsonify(result)
            else:
                return jsonify(result), 404
        
        @self.app.route('/api/match_preferences', methods=['GET', 'POST'])
        @self.require_session
        def match_preferences():
            """获取或设置匹配偏好"""
            username = g.current_user
            db = self._get_db_manager()
            profile_service = ProfileService(db)
            
            if request.method == 'GET':
                result = profile_service.get_match_preferences(username)
                return jsonify(result)
            
            elif request.method == 'POST':
                data = request.get_json()
                result = profile_service.set_match_preferences(username, data)
                
                if result['success']:
                    return jsonify(result)
                else:
                    return jsonify(result), 400
        
        @self.app.route('/api/daily_pushes', methods=['GET'])
        @self.require_session
        def get_daily_pushes():
            """获取今日推送"""
            username = g.current_user
            db = self._get_db_manager()
            matching_service = MatchingService(db)
            result = matching_service.get_daily_pushes(username)
            
            if result['success']:
                return jsonify(result)
            else:
                status_code = 400 if 'Profile incomplete' in result['error'] else 500
                return jsonify(result), status_code
        
        @self.app.route('/api/generate_pushes', methods=['POST'])
        @self.require_session
        def generate_daily_pushes():
            """生成今日推送"""
            username = g.current_user
            db = self._get_db_manager()
            matching_service = MatchingService(db)
            result = matching_service.generate_daily_pushes(username)
            
            if result['success']:
                return jsonify(result)
            else:
                status_code = 400 if 'Profile incomplete' in result['error'] else 500
                return jsonify(result), status_code
        
 
        @self.app.route('/api/respond_push_ecc', methods=['POST'])
        @self.require_session
        def respond_to_push():
            """响应推送（接受/拒绝）"""
            username = g.current_user
            data = request.get_json()
            
            push_id = data.get('push_id')
            encrypt_message_C1_x = data.get('encrypt_message_C1_x')
            encrypt_message_C1_y = data.get('encrypt_message_C1_y')
            encrypt_message_C2_x = data.get('encrypt_message_C2_x')
            encrypt_message_C2_y = data.get('encrypt_message_C2_y')
            encrypt_choice_C1_x = data.get('encrypt_choice_C1_x')
            encrypt_choice_C1_y = data.get('encrypt_choice_C1_y')
            encrypt_choice_C2_x = data.get('encrypt_choice_C2_x')
            encrypt_choice_C2_y = data.get('encrypt_choice_C2_y')
            encrypted_contact = data.get('encrypted_contact')
            
            if not push_id:
                return jsonify({'error': 'Invalid push_id'}), 400
            
            # 获取数据库管理器
            db = self._get_db_manager()
            
            try:
                # 获取推送记录信息
                push_records = db.execute_custom_sql(
                    "SELECT * FROM push_records WHERE id = ? AND from_user = ?",
                    (push_id, username)
                )
                
                if not push_records:
                    return jsonify({'error': '推送记录不存在'}), 404
                
                # 将status标记为accepted
                db.update('push_records', {'status': 'accepted'}, 'id = ?', (push_id,))
                
                push = push_records[0]
                to_user = push['to_user']
                
                # 创建fhe_records记录
                existing_fhe = db.execute_custom_sql(
                    "SELECT * FROM fhe_records WHERE id = ? AND from_user = ?",
                    (push_id, username)
                )
                
                if existing_fhe:
                    return jsonify({'error': 'FHE记录已存在'}), 400
                
                db.insert('fhe_records', {
                    'match_id': push_id,
                    'from_user': username,
                    'to_user': to_user,
                    'encrypt_message_C1_x': encrypt_message_C1_x,
                    'encrypt_message_C1_y': encrypt_message_C1_y,
                    'ecrypt_message_C2_x': encrypt_message_C2_x,
                    'encrypt_message_C2_y': encrypt_message_C2_y,
                    'encrypt_choice_C1_x': encrypt_choice_C1_x,
                    'encrypt_choice_C1_y': encrypt_choice_C1_y,
                    'encrypt_choice_C2_x': encrypt_choice_C2_x,
                    'encrypt_choice_C2_y': encrypt_choice_C2_y,
                    'encrypted_contact': encrypted_contact
                })
                
                return jsonify({
                    'success': True,
                })
                                            
            except Exception as e:
                logging.error(f"Respond to push error: {e}")
                return jsonify({'error': f'操作失败: {str(e)}'}), 500
            
        
        @self.app.route('/api/my_matches', methods=['GET'])
        @self.require_session
        def get_my_matches():
            """获取我的匹配列表"""
            username = g.current_user
            db = self._get_db_manager()
            matching_service = MatchingService(db)
            result = matching_service.get_user_matches(username)
            
            if result['success']:
                return jsonify(result)
            else:
                return jsonify(result), 500
        
        @self.app.route('/api/stats', methods=['GET'])
        @self.require_session
        def get_user_stats():
            """获取用户统计信息"""
            username = g.current_user
            db = self._get_db_manager()
            matching_service = MatchingService(db)
            result = matching_service.get_user_stats(username)
            
            if result['success']:
                return jsonify(result)
            else:
                return jsonify(result), 500
            
        @self.app.route('/api/push_history', methods=['GET'])
        @self.require_session   
        def get_push_history():
            """获取推送历史记录"""
            username = g.current_user
            db = self._get_db_manager()
            
            # 查询条件：from_user为current_user/status为accepted
            push_records = db.execute_custom_sql(
                "SELECT * FROM push_records WHERE from_user = ? AND status = 'accepted' ORDER BY created_at DESC",
                (username,)
            )
            
            # push_records中获取to_user
            if not push_records:
                return jsonify({'error': '没有找到推送记录'}), 404
            
            uname_list = []
            for record in push_records:
                to_user = record['to_user']
                if to_user not in uname_list:
                    uname_list.append(to_user)
                    
            # 获取用户信息
            user_profiles = db.execute_custom_sql(
                "SELECT username, nickname, age, gender, height, weight, education, hobbies, bio FROM user_data WHERE username IN ({})".format(
                    ','.join(['?'] * len(uname_list))
                ),
                tuple(uname_list)
            )
            
            # 构建用户信息映射
            user_info_map = {}
            for user in user_profiles:
                user_info_map[user['username']] = {
                    'username': user['username'],
                    'nickname': user['nickname'],
                    'age': user['age'],
                    'gender': user['gender'],
                    'height': user['height'],
                    'weight': user['weight'],
                    'education': user['education'],
                    'hobbies': user['hobbies'],
                    'bio': user['bio']
                }
            
            # 构建返回结果
            result = []
            for record in push_records:
                to_user = record['to_user']
                user_info = user_info_map.get(to_user, {})
                
                result.append({
                    'push_id': record['id'],
                    'to_user': to_user,
                    'status': record['status'],
                    'created_at': record['created_at'],
                    'user_info': user_info
                })
            return jsonify(result)
                
            
        @self.app.route('/api/fhe_match_results', methods=['POST'])
        @self.require_session
        def get_fhe_match_res():
            """获取fhe匹配结果"""
            username = g.current_user
            data = request.get_json()

            db = self._get_db_manager()
            itsusername = data.get('itsusername')
            
            try:
                # 在user_data中查询昵称对应的username
                if not itsusername:
                    return jsonify({'error': 'itsusername is required'}), 400
                
                to_user = db.execute_custom_sql(
                    "SELECT username FROM user_data WHERE (nickname = ?)",
                    (itsusername,)
                )
                
                if to_user:
                    to_user = to_user[0]['username']  
                else:
                    to_user = None

                if not to_user:
                    return jsonify({'error': 'Invalid itsusername'}), 400
                
                existing_push_record = db.execute_custom_sql(
                    "SELECT * FROM push_records WHERE (from_user = ? AND to_user = ?)",
                    (to_user,username)
                )
                
                if existing_push_record:
                    push_record = existing_push_record[0]
                    # 检查对方是否已经响应
                    if push_record['status'] != 'accepted':
                        # 还未响应发送随机点
                        fake_contact_info = generate_random_message_string()
                        r = GenPrivateKey()
                        R = multiply(G,r)
                        rpk = GenPrivateKey()
                        Rpk = multiply(G,rpk)
                        enc_ = enc(Rpk,R)
                        c1_x = enc_[0][0]
                        c1_y = enc_[0][1]
                        c2_x = enc_[1][0]
                        c2_y = enc_[1][1]
                        return jsonify({
                            'success': True,
                            'c1_x': str(c1_x),
                            'c1_y': str(c1_y),
                            'c2_x': str(c2_x),
                            'c2_y': str(c2_y),
                            'contact_info': str(fake_contact_info)
                        })
                    
                    else:
                    # 如果已响应，获取双方的fhe_records记录
                        fhe_records_current_user = db.execute_custom_sql(
                            "SELECT * FROM fhe_records WHERE (from_user = ? AND to_user = ? )",
                            (username, to_user)
                        )
                        fhe_records_to_user = db.execute_custom_sql(
                            "SELECT * FROM fhe_records WHERE (from_user = ? AND to_user = ? )",
                            (to_user, username)
                        )
                        if not fhe_records_current_user or not fhe_records_to_user:
                            return jsonify({'error': '内部错误'}), 404
                        else:
                            fhe_records_current_user = fhe_records_current_user[0]
                            fhe_records_to_user = fhe_records_to_user[0]
                            
                            my_encchoice_c1_x = fhe_records_current_user['encrypt_choice_C1_x']
                            my_encchoice_c1_y = fhe_records_current_user['encrypt_choice_C1_y']
                            my_encchoice_c2_x = fhe_records_current_user['encrypt_choice_C2_x']
                            my_encchoice_c2_y = fhe_records_current_user['encrypt_choice_C2_y']
                            my_encchoice_c1 = (int(my_encchoice_c1_x),int(my_encchoice_c1_y))
                            my_encchoice_c2 = (int(my_encchoice_c2_x),int(my_encchoice_c2_y))
                            
                            its_encchoice_c1_x = fhe_records_to_user['encrypt_choice_C1_x']
                            its_encchoice_c1_y = fhe_records_to_user['encrypt_choice_C1_y']
                            its_encchoice_c2_x = fhe_records_to_user['encrypt_choice_C2_x']
                            its_encchoice_c2_y = fhe_records_to_user['encrypt_choice_C2_y']
                            its_encchoice_c1 = (int(its_encchoice_c1_x),int(its_encchoice_c1_y))
                            its_encchoice_c2 = (int(its_encchoice_c2_x),int(its_encchoice_c2_y))
                            
                            its_encmessage_c1_x = fhe_records_to_user['encrypt_message_C1_x']
                            its_encmessage_c1_y = fhe_records_to_user['encrypt_message_C1_y']
                            its_encmessage_c2_x = fhe_records_to_user['ecrypt_message_C2_x']
                            its_encmessage_c2_y = fhe_records_to_user['encrypt_message_C2_y']
                            its_encmessage_c1 = (int(its_encmessage_c1_x),int(its_encmessage_c1_y))
                            its_encmessage_c2 = (int(its_encmessage_c2_x),int(its_encmessage_c2_y))
                            
                            r = GenPrivateKey()
                            res = he_add((my_encchoice_c1,my_encchoice_c2),(its_encchoice_c1,its_encchoice_c2))
                            res = [multiply(res[0],r),multiply(res[1],r)]
                            res = he_add(res,(its_encmessage_c1,its_encmessage_c2))
                            
                            c1_x = res[0][0]
                            c1_y = res[0][1]
                            c2_x = res[1][0]
                            c2_y = res[1][1]
                            its_enc_contact_info = str(fhe_records_to_user['encrypted_contact'])
                            
                            return jsonify({
                                'success': True,
                                'c1_x': str(c1_x),
                                'c1_y': str(c1_y),
                                'c2_x': str(c2_x),
                                'c2_y': str(c2_y),
                                'contact_info': its_enc_contact_info
                            })
                else:
                    return jsonify({'error': '没有找到匹配的FHE记录'}), 404
                
            except Exception as e:
                logging.error(f"Get FHE match results error: {e}")
                return jsonify({'error': f'操作失败: {str(e)}'}), 500